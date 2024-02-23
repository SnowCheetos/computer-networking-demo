package src

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type Server struct {
	clients map[string]*Client
	logs    []string
	mutex   sync.RWMutex
	maxLogs int
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewServer(maxLogs int) *Server {
	return &Server{
		clients: make(map[string]*Client),
		maxLogs: maxLogs,
	}
}

func (s *Server) addClient(clientName string, conn *websocket.Conn) *Client {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.writeToLogs(makeLogMessage(getTimestamp(),
		fmt.Sprintf(`<div class="name-tag">%s</div><div>just joined!</div>`, clientName)))

	client := Client{name: clientName, conn: conn, send: make(chan Message)}
	s.clients[clientName] = &client
	return &client
}

func (s *Server) delClient(clientName string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if client, exists := s.clients[clientName]; exists {
		close(client.send)
		delete(s.clients, clientName)
	}
	s.writeToLogs(makeLogMessage(getTimestamp(),
		fmt.Sprintf(`<div class="name-tag">%s</div><div>just left!</div>`, clientName)))
}

func (s *Server) getClient(clientName string) (*Client, bool) {
	if client, exists := s.clients[clientName]; exists {
		return client, true
	}
	return nil, false
}

func (s *Server) InitClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientName := vars["client_name"]

	if _, exists := s.getClient(clientName); exists {
		http.Error(w, "Client already exists", http.StatusBadRequest)
	}
}

func (s *Server) writeToLogs(m string) {
	s.logs = append(s.logs, m)
}

func (s *Server) getGlobalLogs(n int) []string {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	totalMessages := len(s.logs)

	startIndex := totalMessages - n
	if startIndex < 0 {
		startIndex = 0
	}

	return s.logs[startIndex:]
}

func (s *Server) getClientList() []string {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	keys := make([]string, 0, len(s.clients))

	// Iterate over the map and append each key to the slice
	for key := range s.clients {
		keys = append(keys, key)
	}
	return keys
}

func (s *Server) HandleConnection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientName := vars["client_name"]

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Error upgrading to WebSocket:", err)
		return
	}
	client := s.addClient(clientName, conn)

	go client.writePump()
	go client.readPump(s)
}

func (s *Server) GlobalDataStream(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Error upgrading to WebSocket:", err)
		return
	}

	defer conn.Close()

	for {
		message := GlobalData{
			Clients: s.getClientList(),
			Logs:    s.getGlobalLogs(s.maxLogs),
		}

		data, err := json.Marshal(message)
		if err != nil {
			log.Println("Error parsing JSON")
			break
		}

		conn.WriteMessage(websocket.TextMessage, data)

		time.Sleep(1 * time.Second)
	}
}
