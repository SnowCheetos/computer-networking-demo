const ws_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const tcp_packet_size = 24;
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
    <div>${origin}:</div>
    <div>${data}</div>`;
    console.log("added new udp message");
    messages.appendChild(listItem);
};

function addTCPMessage(message_id, origin, data) {
    const messages = document.getElementById('private-messages');
    let found = false;
    Array.from(messages.children).forEach(child => {
        if (child.id === message_id) {
            found = true;
            const dataDiv = child.getElementsByTagName('div')[1]; // Assuming it's always the second div
            dataDiv.textContent += data;
        }
    });
    if (!found) {
        const listItem = document.createElement('li');
        listItem.id = message_id;
        listItem.innerHTML = `
        <div>${origin}:</div>
        <div>${data}</div>`;
        console.log("added new tcp message");
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
            <div class="name-tag">${item}</div>
            <div class="client-buttons"> 
                <div class="udp-button">UDP</div>
                <div class="tcp-button">TCP</div>
                <div class="http-button">HTTP</div>
            </div>`;

            const udp_button = listItem.querySelector('.udp-button');
            udp_button.addEventListener('click', () => {
                const udp_holder = document.getElementById('udp-message-holder');
                udp_holder.style.display = 'block';
                udp_destination = item;
            });

            const tcp_button = listItem.querySelector('.tcp-button');
            tcp_button.addEventListener('click', () => {
                const tcp_holder = document.getElementById('tcp-message-holder');
                tcp_holder.style.display = 'block';
                tcp_destination = item;
            });

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
    event.preventDefault();
    if (udp_destination !== null) {
        const message = document.getElementById('udp-message').value;
        client_ws.send(JSON.stringify({
            operation: 'message',
            uuid: crypto.randomUUID(),
            to: udp_destination,
            message: `[BEG]${message}[END]`
        }));
        udp_destination = null;
    };
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
    }
});

document.getElementById('tcp-done-button').addEventListener('click', function(event) {
    event.preventDefault();
    if (tcp_destination !== null) {
        // Send the remaining part of the message with [END] to indicate completion
        client_ws.send(JSON.stringify({
            operation: 'message',
            uuid: tcp_uuid,
            to: tcp_destination,
            message: tcp_message + '[END]'
        }));
        tcp_destination = null; // Clear the destination
    }
    tcp_message = '[BEG]'; // Reset the message buffer to its initial state
    document.getElementById('tcp-message-holder').style.display = 'none'; // Hide the message holder
});
