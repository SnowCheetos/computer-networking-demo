package src

import (
	"fmt"
	"time"
)

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

func makeLogMessage(timestamp, message string) string {
	return fmt.Sprintf(`
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="timestamp-class">%s</div>
            <div class="log-tag">LOG</div>
            <div class="log-message">%s</div>
        </div>
    </div>
    `, timestamp, message)
}

func makeUDPMessage(timestamp, from, to, message string) string {
	return fmt.Sprintf(`
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="timestamp-class">%s</div>
            <div class="udp-tag">UDP</div>
            <div class="name-tag">%s</div>
            <div>sent a message to</div>
            <div class="name-tag">%s:</div>
        </div>  
        <div class="global-message-content">%s</div>
    </div>
    `, timestamp, from, to, message)
}

func makeTCPMessage(timestamp, from, to, message string) string {
	return fmt.Sprintf(`
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="timestamp-class">%s</div>
            <div class="tcp-tag">TCP</div>
            <div class="name-tag">%s</div>
            <div>sent a message to</div>
            <div class="name-tag">%s:</div>
        </div>  
        <div class="global-message-content">%s</div>
    </div>
    `, timestamp, from, to, message)
}

func makeGETMessage(timestamp, from, to, message string) string {
	return fmt.Sprintf(`
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="timestamp-class">%s</div>
            <div class="get-tag">GET</div>
            <div class="name-tag">%s</div>
            <div>sent a message to</div>
            <div class="name-tag">%s:</div>
        </div>  
        <div class="global-message-content">%s</div>
    </div>
    `, timestamp, from, to, message)
}

func makePOSTMessage(timestamp, from, to, message string) string {
	return fmt.Sprintf(`
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="timestamp-class">%s</div>
            <div class="post-tag">POST</div>
            <div class="name-tag">%s</div>
            <div>sent a message to</div>
            <div class="name-tag">%s:</div>
        </div>  
        <div class="global-message-content">%s</div>
    </div>
    `, timestamp, from, to, message)
}

func makeHTTPMessage(timestamp, from, to, message string) string {
	return fmt.Sprintf(`
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="timestamp-class">%s</div>
            <div class="http-tag">RES</div>
            <div class="name-tag">%s</div>
            <div>sent a message to</div>
            <div class="name-tag">%s:</div>
        </div>  
        <div class="global-message-content">%s</div>
    </div>
    `, timestamp, from, to, message)
}
