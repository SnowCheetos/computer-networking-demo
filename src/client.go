package src

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/gorilla/websocket"
)

type Client struct {
	name       string
	conn       *websocket.Conn
	globalConn *websocket.Conn
	send       chan Message
}

func (c *Client) readPump(s *Server) {
	defer func() {
		c.conn.Close()
		s.delClient(c.name)
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				fmt.Printf("Error: %v", err)
			}
			break
		}

		var data Message

		if err := json.Unmarshal([]byte(message), &data); err != nil {
			log.Println("Error parsing JSON")
			break
		}

		switch data.Operation {
		case "udp":
			s.writeToLogs(makeUDPMessage(getTimestamp(), data.From, data.To, data.Message))
		case "tcp":
			s.writeToLogs(makeTCPMessage(getTimestamp(), data.From, data.To, data.Message))
		case "get":
			s.writeToLogs(makeGETMessage(getTimestamp(), data.From, data.To, data.Message))
		case "post":
			s.writeToLogs(makePOSTMessage(getTimestamp(), data.From, data.To, data.Message))
		case "response":
			s.writeToLogs(makeHTTPMessage(getTimestamp(), data.From, data.To, data.Message))
		}

		if client, exists := s.getClient(data.To); exists {
			client.send <- data
		}
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
			message.Timestamp = getTimestamp()
			messageLen := len(message.Message)
			message.Message = message.Message[5 : messageLen-5]

			data, err := json.Marshal(message)
			if err != nil {
				log.Println("Error parsing JSON")
				break
			}
			c.conn.WriteMessage(websocket.TextMessage, data)
		}
	}
}
