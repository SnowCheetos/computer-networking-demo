const ws_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
let tcp_packet_size = 6;
let client_ws = null;
let global_ws = null;
let client_name = null;
let udp_destination = null;
let tcp_destination = null;
let http_destination = null;
let tcp_message = '[BEG]';
let tcp_uuid = crypto.randomUUID();
let http_method = 'GET';
let http_request_uuid = null;
let http_response_uuid = null;

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
        } else if (data.type === 'tcp') {
            addTCPMessage(data.uuid, data.from, data.message);
        } else if (data.type === 'get') {
            addGETMessage(data.uuid, data.from, data.message);
        } else if (data.type === 'response') {
            addRESMessage(data.uuid, data.from, data.message);
        };
    };
    document.getElementById('input-name').style.display = 'none';
    document.getElementById('main-page').style.display = 'flex';
};

function addRESMessage(message_id, origin, data) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    listItem.innerHTML = `
    <div class="http-message-class">
        <div class="http-metadata-tag">
            <div class="http-tag">HTTP</div>
            <div class="http-origin">${origin}:</div>
        </div>
        <div class="http-message-content">${data}</div>
    </div>`;
    messages.appendChild(listItem);
}

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

function addGETMessage(message_id, origin, data) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    listItem.id = message_id;
    listItem.innerHTML = `
    <div class="get-message-class">
        <div class="get-metadata-tag">
            <div class="get-tag">GET</div>
            <div class="get-origin">${origin}:</div>
        </div>
        <div class="http-message-content">
            <div>What is your ${data}?</div>
            <div class="http-response-button">Respond</div>
        </div>
    </div>`;
    const response_button = listItem.querySelector('.http-response-button');
    response_button.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const response_holder = document.getElementById('http-response-holder');
        response_holder.style.display = 'flex';
        const respond_button = response_holder.querySelector('.http-response-send-button');
        respond_button.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const message = response_holder.querySelector('.http-response-body').value;
            client_ws.send(JSON.stringify({
                operation: 'response',
                uuid: message_id,
                to: origin,
                message: `[RES]My ${data} is ${message}[END]`
            }));
            response_button.style.display = 'none';
            response_holder.style.display = 'none';
        });
    });
    messages.appendChild(listItem);
};

function addTCPMessage(message_id, origin, data) {
    const messages = document.getElementById('private-messages');
    let found = false;
    Array.from(messages.children).forEach(child => {
        if (child.id === message_id) {
            found = true;
            console.log(message_id);
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
                event.preventDefault();
                event.stopPropagation();
                const udp_holder = document.getElementById('udp-message-holder');
                udp_holder.style.display = 'flex';
                udp_destination = item;
            });

            const tcp_button = listItem.querySelector('.tcp-button');
            tcp_button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const tcp_holder = document.getElementById('tcp-message-holder');
                tcp_holder.style.display = 'flex';
                tcp_destination = item;
            });

            const http_button = listItem.querySelector('.http-button');
            http_button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const http_request_holder = document.getElementById('http-request-holder');
                document.getElementById('http-get-destination').textContent = `${item}'s`;
                document.getElementById('http-post-destination').textContent = item;
                http_request_holder.style.display = 'flex';
                http_destination = item;
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
                operation: 'udp',
                uuid: crypto.randomUUID(),
                to: udp_destination,
                message: `[BEG]${message}[END]`}))};
        udp_destination = null;
    };
    document.getElementById('udp-message').value = '';
    document.getElementById('udp-message-holder').style.display = 'none';
});

document.getElementById('tcp-message').addEventListener('input', function(e) {
    // Append only the new input value
    let newInput = e.data; // Gets the input character
    if (!newInput) return; // If no input (e.g., delete), then do nothing

    tcp_message += newInput; // Append the new character to the message

    if (tcp_destination !== null && tcp_message.length >= tcp_packet_size) {
        // Send the current message chunk
        client_ws.send(JSON.stringify({
            operation: 'tcp',
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
                operation: 'tcp',
                uuid: tcp_uuid,
                to: tcp_destination,
                message: tcp_message + '[END]'}))};
        tcp_destination = null; // Clear the destination
    }
    tcp_packet_size = 6;
    tcp_message = '[BEG]'; // Reset the message buffer to its initial state
    tcp_uuid = crypto.randomUUID();
    document.getElementById('tcp-message').value = '';
    document.getElementById('tcp-message-holder').style.display = 'none'; // Hide the message holder
});

document.getElementById('http-method').addEventListener('change', function() {
    http_method = this.value;

    switch (http_method) {
        case 'GET':
            document.getElementById('http-get-configuration').style.display = 'inline';
            document.getElementById('http-post-configuration').style.display = 'none';
            document.getElementById('http-post-body').style.display = 'none';
            break;

        case 'POST':
            document.getElementById('http-post-configuration').style.display = 'inline';
            document.getElementById('http-get-configuration').style.display = 'none';
            document.getElementById('http-post-body').style.display = 'flex';
            break;

        default:
            document.getElementById('http-get-configuration').style.display = 'inline';
            document.getElementById('http-post-configuration').style.display = 'none';
            document.getElementById('http-post-body').style.display = 'none';
            break;
    }
});

document.getElementById('http-send-button').addEventListener('click', function(event) {
    event.stopPropagation();
    event.preventDefault();
    http_request_uuid = crypto.randomUUID();
    if (http_destination !== null) {
        if (http_method === 'GET') {
            const get_option = document.getElementById('http-get-options').value;
            client_ws.send(JSON.stringify({
                operation: 'get',
                uuid: http_request_uuid,
                to: http_destination,
                message: `[BEG]${get_option}[REQ]`}));

        } else if (http_method === 'POST') {
            const post_body = document.getElementById('http-post-body').value;
            if (post_body.length > 0) {
                client_ws.send(JSON.stringify({
                    operation: 'post',
                    uuid: http_request_uuid,
                    to: http_destination,
                    message: `[BEG]${post_body}[REQ]`}))};
        }
    }
    http_destination = null;
    http_request_uuid = null;
    document.getElementById('http-get-destination').textContent = '';
    document.getElementById('http-post-destination').textContent = '';
    document.getElementById('http-request-holder').style.display = 'none';
});