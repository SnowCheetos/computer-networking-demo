package main

import (
	"goserver/src"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	server := src.NewServer(50, "961e187b04f4c1d6c087401cdfb2b11414a3e91a780fd51b599ba31ea5ea09a3")
	r := mux.NewRouter()

	r.HandleFunc("/client/init/{client_name}", server.InitClient).Methods("GET")
	r.HandleFunc("/connect/{client_name}", server.HandleConnection).Methods("GET")
	r.HandleFunc("/global_data", server.GlobalDataStream).Methods("GET")

	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/")))

	err := http.ListenAndServe(":8000", r)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}
