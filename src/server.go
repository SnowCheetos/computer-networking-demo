package src

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type Server struct {
	clients   map[string]*Client
	logs      []string
	mutex     sync.RWMutex
	maxLogs   int
	adminHash string
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func NewServer(maxLogs int, adminHash string) *Server {
	return &Server{
		clients:   make(map[string]*Client),
		maxLogs:   maxLogs,
		adminHash: adminHash,
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

func (s *Server) isAdmin(clientName string) bool {
	hash := sha256.Sum256([]byte(strings.ToLower(clientName)))
	hashString := hex.EncodeToString(hash[:]) // Convert the hash to a hexadecimal string
	return hashString == s.adminHash
}

func (s *Server) InitClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientName := vars["client_name"]

	if _, exists := s.getClient(clientName); exists {
		http.Error(w, "Client already exists", http.StatusBadRequest)
	}

	admin := s.isAdmin(clientName)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(InitResp{Admin: admin})
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
