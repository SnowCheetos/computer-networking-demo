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
