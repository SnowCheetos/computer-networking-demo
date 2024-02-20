const ws_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
let tcp_packet_size = 6;
let client_ws = null;
let global_ws = null;
let client_name = null;
let udp_destination = null;
let tcp_destination = null;
let http_destination = null;
let tcp_message = '[BEG]';
let tcp_uuid = null;

if (sessionStorage.getItem('name') !== null) {
    client_name = sessionStorage.getItem('name');
    initClient(client_name);
};

function initClient(name) {
    fetch(`${window.location.protocol}//${window.location.host}/client/init/${name}`)        
    .then(response => {
        if (response.status == 200) {
            initClientWebSocket(name);
            initGlobalWebSocket();
        } else if (response.status === 400) {
            document.getElementById('duplicated-name').style.display = 'block';
        }
    })
    .catch(error => console.error('Error fetching device data:', error));
    const welcome_message = document.getElementById('welcome-message');
    welcome_message.textContent = `Welcome to my L&L, ${name}!`;
};

function initClientWebSocket(name) {
    client_ws = new WebSocket(`${ws_protocol}//${window.location.host}/connect/${name}`);
    client_ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (data.type === 'udp') {
            addUDPMessage(data.from, data.message);
        } else if (data.type == 'tcp') {
            addTCPMessage(data.uuid, data.from, data.message);
        };
    };
    document.getElementById('input-name').style.display = 'none';
    document.getElementById('main-page').style.display = 'flex';
};

function addUDPMessage(origin, data) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    listItem.innerHTML = `
    <div class="udp-message-class">
        <div class="udp-metadata-tag">
            <div class="udp-tag">UDP</div>
            <div class="udp-origin">${origin}:</div>
        </div>
        <div class="udp-message-content">${data}</div>
    </div>`;
    messages.appendChild(listItem);
};

function addTCPMessage(message_id, origin, data) {
    const messages = document.getElementById('private-messages');
    let found = false;
    Array.from(messages.children).forEach(child => {
        if (child.id === message_id) {
            found = true;
            let dataContainer = child.querySelector('.tcp-message-content');
            if (!dataContainer) {
                dataContainer = document.createElement('div');
                dataContainer.className = 'tcp-message-content';
                child.querySelector('.tcp-message-class').appendChild(dataContainer);
            }
            dataContainer.textContent += data;
        }
    });
    if (!found) {
        const listItem = document.createElement('li');
        listItem.id = message_id;
        listItem.innerHTML = `
        <div class="tcp-message-class">
            <div class="tcp-metadata-tag">
                <div class="tcp-tag">TCP</div>
                <div class="tcp-origin">${origin}:</div>
            </div>  
            <div class="tcp-message-content">${data}</div>
        </div>`;
        messages.appendChild(listItem);
    };
};

function initGlobalWebSocket() {
    global_ws = new WebSocket(`${ws_protocol}//${window.location.host}/global_data`);
    global_ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        const log_container = document.getElementById("global-message-logs");
        const client_container = document.getElementById("clients-list");
        populateLogs(log_container, data.global_logs);
        populateClients(client_container, data.clients);
    }
};

function populateClients(container, data) {
    // Convert data to a set for faster lookup
    const dataSet = new Set(data);

    // Remove items not in the data
    Array.from(container.children).forEach(child => {
        if (!dataSet.has(child.id)) {
            container.removeChild(child);
        }
    });

    // Add new items from data
    data.forEach(item => {
        const exists = Array.from(container.children).some(child => child.id === item);
        if (!exists && item != client_name) {
            const listItem = document.createElement('li');
            listItem.id = item;
            listItem.innerHTML = `
            <div class="client-name-tag">${item}</div>
            <div class="client-buttons"> 
                <div class="udp-button">UDP</div>
                <div class="tcp-button">TCP</div>
                <div class="http-button">HTTP</div>
            </div>`;

            const udp_button = listItem.querySelector('.udp-button');
            udp_button.addEventListener('click', (event) => {
                event.stopPropagation();
                const udp_holder = document.getElementById('udp-message-holder');
                udp_holder.style.display = 'flex';
                udp_destination = item;
            });

            const tcp_button = listItem.querySelector('.tcp-button');
            tcp_button.addEventListener('click', (event) => {
                event.stopPropagation();
                const tcp_holder = document.getElementById('tcp-message-holder');
                tcp_holder.style.display = 'flex';
                tcp_destination = item;
            });

            const http_button = listItem.querySelector('.http-button');
            http_button.addEventListener('click', (event) => {
                event.stopPropagation();
                const http_request_holder = document.getElementById('http-request-holder');
                http_request_holder.style.display = 'flex';
            })

            container.appendChild(listItem);
        }
    });
};

function populateLogs(container, data) {
    container.innerHTML = '';
    data.forEach(line => {
        const listItem = document.createElement('li');
        listItem.innerHTML = line;
        container.appendChild(listItem);
    });
};

document.getElementById('connect-button').addEventListener('click', function(event){
    event.preventDefault();
    client_name = document.getElementById('client-name').value;
    sessionStorage.setItem('name', client_name);
    initClient(client_name);
});

document.getElementById('udp-send-button').addEventListener('click', function(event){
    event.stopPropagation();
    event.preventDefault();
    if (udp_destination !== null) {
        const message = document.getElementById('udp-message').value;
        if (message.length > 0) {
            client_ws.send(JSON.stringify({
                operation: 'message',
                uuid: crypto.randomUUID(),
                to: udp_destination,
                message: `[BEG]${message}[END]`}))};
        udp_destination = null;
    };
    document.getElementById('udp-message').value = '';
    document.getElementById('udp-message-holder').style.display = 'none';
});

document.getElementById('tcp-message').addEventListener('input', function(e) {
    if (tcp_message === '[BEG]') {
        tcp_uuid = crypto.randomUUID();
    };
    // Append only the new input value
    let newInput = e.data; // Gets the input character
    if (!newInput) return; // If no input (e.g., delete), then do nothing

    tcp_message += newInput; // Append the new character to the message

    if (tcp_destination !== null && tcp_message.length >= tcp_packet_size) {
        // Send the current message chunk
        client_ws.send(JSON.stringify({
            operation: 'message',
            uuid: tcp_uuid,
            to: tcp_destination,
            message: tcp_message + '[CON]' // Append [CON] to indicate continuation
        }));
        tcp_message = '[CON]'; // Clear the message buffer after sending
        if (tcp_packet_size == 6) {
            tcp_packet_size = 12;
        };
    }
});

document.getElementById('tcp-done-button').addEventListener('click', function(event) {
    event.stopPropagation();
    event.preventDefault();
    if (tcp_destination !== null) {
        // Send the remaining part of the message with [END] to indicate completion
        if (tcp_message !== '[BEG]') {
            client_ws.send(JSON.stringify({
                operation: 'message',
                uuid: tcp_uuid,
                to: tcp_destination,
                message: tcp_message + '[END]'}))};
        tcp_destination = null; // Clear the destination
    }
    tcp_packet_size = 6;
    tcp_message = '[BEG]'; // Reset the message buffer to its initial state
    document.getElementById('tcp-message').value = '';
    document.getElementById('tcp-message-holder').style.display = 'none'; // Hide the message holder
});
