const ws_protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const response_holder = document.getElementById('http-response-holder');
const respond_button = response_holder.querySelector('.http-response-send-button');
const max_messages = 10;
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
let http_requests = {};
let curr_http_origin = null;
let curr_message_id = null;
let curr_response_btn_id = null;
let client_name_color = {};
let use_https = false;
let resp_https = {};
let ssl_key = "fb1c6285e40ae416300b35d2d2c400e45306b81ed3e9ab3c9297a7c688c6edf8";

function generateRandomColor() {
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += Math.floor(Math.random() * 10);
    }
    return color;
}

function trimListToMaxSize(ulId, maxSize) {
    // Select the unordered list by its ID
    const ul = document.getElementById(ulId);

    // Check if the list exists
    if (!ul) {
        console.log('List not found!');
        return;
    }

    // While the number of <li> elements in the list exceeds maxSize, remove the first one
    while (ul.children.length > maxSize) {
        // Remove the first child <li> element
        ul.removeChild(ul.firstChild);
    }
}

function encrypt(message, secretKey) {
    return CryptoJS.AES.encrypt(message, secretKey).toString();
}

function decrypt(ciphertext, secretKey) {
    var bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    return bytes.toString(CryptoJS.enc.Utf8);
}

function cachePrivateMessages() {
    sessionStorage.setItem('messages', document.getElementById('private-messages').innerHTML);
}

function cacheColorMap() {
    sessionStorage.setItem('color-map', JSON.stringify(client_name_color));
}

function loadCachedMessages() {
    document.getElementById('private-messages').innerHTML = sessionStorage.getItem('messages');
}

function loadColorMap() {
    client_name_color = JSON.parse(sessionStorage.getItem('color-map'));
}

if (sessionStorage.getItem('name') !== null) {
    client_name = sessionStorage.getItem('name');
    initClient(client_name);
};

respond_button.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    var data = response_holder.querySelector('.http-response-body').value;
    let message = '';
    const curr_resp_https = resp_https[curr_message_id];
    if (resp_https[curr_message_id]) {
        message = encrypt(data, ssl_key);
    } else {
        message = data;
    }
    if (curr_message_id) {
        client_ws.send(JSON.stringify({
            operation: 'response',
            uuid: curr_message_id,
            https: curr_resp_https,
            to: curr_http_origin,
            message: `[RES]${message}[END]`
        }));
        response_holder.style.display = 'none';
        document.getElementById(curr_response_btn_id).style.display = 'none';
        document.getElementById(`${curr_message_id}:message-content`).textContent += ' ✅';
        curr_message_id = null;
        curr_http_origin = null;
        curr_response_btn_id = null
        response_holder.querySelector('.http-response-body').value = '';
        cachePrivateMessages();
    }
});

function initClient(name) {
    if (sessionStorage.getItem('color-map') !== null) {
        loadColorMap();
    }

    if (!client_name_color[name]) {
        client_name_color[name] = generateRandomColor();
        cacheColorMap();
    }
    fetch(`${window.location.protocol}//${window.location.host}/client/init/${name}`)        
    .then(response => {
        if (response.status == 200) {
            initClientWebSocket(name);
            initGlobalWebSocket();
        } else if (response.status === 400) {
            document.getElementById('duplicated-name').style.display = 'flex';
        }
    })
    .catch(error => console.error('Error fetching device data:', error));
    const welcome_message = document.getElementById('welcome-message');
    welcome_message.textContent = `Welcome to my L&L, ${name}!`;
    loadCachedMessages();
};

function initClientWebSocket(name) {
    client_ws = new WebSocket(`${ws_protocol}//${window.location.host}/connect/${name}`);
    client_ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (!client_name_color[data.from]) {
            client_name_color[data.from] = generateRandomColor();
            cacheColorMap();
        }
        if (data.type === 'udp') {
            addUDPMessage(data.timestamp, data.from, data.message);
        } else if (data.type === 'tcp') {
            addTCPMessage(data.timestamp, data.uuid, data.from, data.message);
        } else if (data.type === 'get') {
            addGETMessage(data.timestamp, data.uuid, data.from, data.message, data.https);
        } else if (data.type === 'post') {
            addPOSTMessage(data.timestamp, data.uuid, data.from, data.message, data.https);
        } else if (data.type === 'response') {
            addRESMessage(data.timestamp, data.uuid, data.from, data.message, data.https);
        };
        trimListToMaxSize('private-messages', max_messages);
        cachePrivateMessages();
    };
    document.getElementById('input-name').style.display = 'none';
    document.getElementById('main-page').style.display = 'flex';
};

function addRESMessage(timestamp, message_id, origin, data, https) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    const request_body = http_requests[message_id];

    let message = '';
    if (https) {
        message = decrypt(data, ssl_key);
    } else {
        message = data;
    }

    listItem.innerHTML = `
    <div class="http-message-class">
        <div class="http-metadata-tag">
            <div class="timestamp-class">${timestamp}</div>
            <div class="http-tag">HTTP</div>
            <div class="http-origin">${origin}:</div>
        </div>
        <div class="http-message-content">
            <div>
                Q: ${request_body}
            </div>
            <div>
                A: ${message}
            </div>
        </div>
    </div>`;
    listItem.querySelector('.http-origin').style.color = client_name_color[origin];
    messages.appendChild(listItem);
}

function addUDPMessage(timestamp, origin, data) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    listItem.innerHTML = `
    <div class="udp-message-class">
        <div class="udp-metadata-tag">
            <div class="timestamp-class">${timestamp}</div>
            <div class="udp-tag">UDP</div>
            <div class="udp-origin">${origin}:</div>
        </div>
        <div class="udp-message-content">${data}</div>
    </div>`;
    listItem.querySelector('.udp-origin').style.color = client_name_color[origin];
    messages.appendChild(listItem);
};

function addGETMessage(timestamp, message_id, origin, data, https) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    let message = '';
    if (https) {
        message = decrypt(data, ssl_key);
        resp_https[message_id] = true;
    } else {
        message = data;
    }
    listItem.id = message_id;
    listItem.innerHTML = `
    <div class="get-message-class">
        <div class="get-metadata-tag">
            <div class="timestamp-class">${timestamp}</div>
            <div class="get-tag">GET</div>
            <div class="get-origin">${origin}:</div>
        </div>
        <div class="http-message-content">
            <div id="${message_id}:message-content">What is your ${message}?</div>
            <div class="http-response-button" id="${message_id}:response-button">Respond</div>
        </div>
    </div>`;
    const response_button = listItem.querySelector('.http-response-button');
    response_button.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        curr_response_btn_id = `${message_id}:response-button`;
        curr_http_origin = origin;
        curr_message_id = message_id;
        response_holder.style.display = 'flex';
    });
    listItem.querySelector('.get-origin').style.color = client_name_color[origin];
    messages.appendChild(listItem);
};

function addPOSTMessage(timestamp, message_id, origin, data, https) {
    const messages = document.getElementById('private-messages');
    const listItem = document.createElement('li');
    let message = '';
    if (https) {
        message = decrypt(data, ssl_key);
        resp_https[message_id] = true;
    } else {
        message = data;
    }
    listItem.id = message_id;
    listItem.innerHTML = `
    <div class="post-message-class">
        <div class="post-metadata-tag">
            <div class="timestamp-class">${timestamp}</div>
            <div class="post-tag">POST</div>
            <div class="post-origin">${origin}:</div>
        </div>
        <div class="http-message-content">
            <div id="${message_id}:message-content">${message}?</div>
            <div class="http-response-button" id="${message_id}:response-button">Respond</div>
        </div>
    </div>`;
    const response_button = listItem.querySelector('.http-response-button');
    response_button.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        curr_response_btn_id = `${message_id}:response-button`;
        curr_http_origin = origin;
        curr_message_id = message_id;
        response_holder.style.display = 'flex';
    });
    listItem.querySelector('.post-origin').style.color = client_name_color[origin];
    messages.appendChild(listItem);
};

function addTCPMessage(timestamp, message_id, origin, data) {
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
                <div class="timestamp-class">${timestamp}</div>
                <div class="tcp-tag">TCP</div>
                <div class="tcp-origin">${origin}:</div>
            </div>  
            <div class="tcp-message-content">${data}</div>
        </div>`;
        listItem.querySelector('.tcp-origin').style.color = client_name_color[origin];
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
                <div class="https-button">HTTPS</div>
                <div class="websocket-button">WebSocket</div>
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
            });
            
            const https_button = listItem.querySelector('.https-button');
            https_button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                use_https = true;
                const http_request_holder = document.getElementById('http-request-holder');
                document.getElementById('http-get-destination').textContent = `${item}'s`;
                document.getElementById('http-post-destination').textContent = item;
                http_request_holder.style.display = 'flex';
                http_destination = item;
            });

            if (!client_name_color[item]) {
                client_name_color[item] = generateRandomColor();
                cacheColorMap();
            }
            listItem.querySelector('.client-name-tag').style.color = client_name_color[item];
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

document.getElementById('connect-button').addEventListener('pointerdown', function(event){
    event.preventDefault();
    event.stopPropagation();
    client_name = document.getElementById('client-name').value;
    sessionStorage.setItem('name', client_name);
    initClient(client_name);
});

document.getElementById('udp-send-button').addEventListener('click', function(event) {
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
            let message = '';
            if (use_https) {
                message = encrypt(get_option, ssl_key);
            } else {
                message = get_option;
            }
            client_ws.send(JSON.stringify({
                operation: 'get',
                https: use_https,
                uuid: http_request_uuid,
                to: http_destination,
                message: `[BEG]${message}[REQ]`}));
            http_requests[http_request_uuid] = `What is your ${get_option}?`;

        } else if (http_method === 'POST') {
            const post_body = document.getElementById('http-post-body').value;
            let message = '';
            if (use_https) {
                message = encrypt(post_body, ssl_key);
            } else {
                message = get_option;
            }
            if (post_body.length > 0) {
                client_ws.send(JSON.stringify({
                    operation: 'post',
                    https: use_https,
                    uuid: http_request_uuid,
                    to: http_destination,
                    message: `[BEG]${message}[REQ]`}))};
            http_requests[http_request_uuid] = post_body + '?';
            document.getElementById('http-post-body').value = '';
        }
    }
    use_https = false;
    http_destination = null;
    http_request_uuid = null;
    document.getElementById('http-get-destination').textContent = '';
    document.getElementById('http-post-destination').textContent = '';
    document.getElementById('http-request-holder').style.display = 'none';
});