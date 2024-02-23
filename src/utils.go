package src

import "time"

type Message struct {
	Operation string `json:"operation"`
	Timestamp string `json:"timestamp"`
	UUID      string `json:"uuid"`
	HTTPS     bool   `json:"https"`
	From      string `json:"from"`
	To        string `json:"to"`
	Message   string `json:"message"`
}

type GlobalData struct {
	Clients []string `json:"clients"`
	Logs    []string `json:"global_logs"`
}

func getTimestamp() string {
	return time.Now().Format("15:04:05")
}
