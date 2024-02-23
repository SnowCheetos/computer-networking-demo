package src

import (
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type Client struct {
	conn *websocket.Conn
	send chan []byte // Channel for sending messages
}

type Server struct {
	clients    map[*Client]bool // Registered clients
	register   chan *Client     // Register requests from the clients
	unregister chan *Client     // Unregister requests from clients
	broadcast  chan []byte      // Broadcast messages to clients
	mutex      sync.RWMutex
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Adjust the origin check for your requirements
	},
}

func NewServer() *Server {
	return &Server{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte),
	}
}

func (s *Server) InitClientHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientName := vars["client_name"]

	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Check if the client name is already registered
	if _, exists := s.clients[clientName]; exists {
		http.Error(w, "Client name already registered", http.StatusBadRequest)
		return
	}

	// Register the new client
	s.clients[clientName] = true
	w.WriteHeader(http.StatusOK)
}

func (s *Server) run() {
	for {
		select {
		case client := <-s.register:
			s.clients[client] = true
		case client := <-s.unregister:
			if _, ok := s.clients[client]; ok {
				delete(s.clients, client)
				close(client.send)
			}
		case message := <-s.broadcast:
			for client := range s.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(s.clients, client)
				}
			}
		}
	}
}

func (s *Server) handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Error upgrading to WebSocket:", err)
		return
	}
	client := &Client{conn: conn, send: make(chan []byte, 256)}
	s.register <- client

	go client.writePump()
	go client.readPump(s)
}

func (c *Client) readPump(s *Server) {
	defer func() {
		s.unregister <- c
		c.conn.Close()
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("Error: %v", err)
			}
			break
		}
		s.broadcast <- message
	}
}

func (c *Client) writePump() {
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}
