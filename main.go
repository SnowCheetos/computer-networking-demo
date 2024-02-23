package main

import (
	"log"
	"net/http"

	"goserver/src"
)

func main() {
	server := src.NewServer()

	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "static/index.html")
	})

	// Handle WebSocket requests
	http.HandleFunc("/ws", handleConnections)

	http.HandleFunc("/client/init/{client_name}", server.InitClientHandler)

	// Start the server on localhost port 8080
	log.Println("Starting server on :8080")
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
