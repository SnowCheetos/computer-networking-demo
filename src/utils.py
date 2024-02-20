from datetime import datetime
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from base64 import b64encode, b64decode
import hashlib

def encrypt(message, secretKey):
    key = hashlib.sha256(secretKey.encode()).digest()  # 32 bytes
    cipher = AES.new(key, AES.MODE_ECB)
    ciphertext = cipher.encrypt(pad(message.encode(), AES.block_size))
    return b64encode(ciphertext).decode()

def decrypt(ciphertext, secretKey):
    key = hashlib.sha256(secretKey.encode()).digest()  # 32 bytes
    cipher = AES.new(key, AES.MODE_ECB)
    plaintext = unpad(cipher.decrypt(b64decode(ciphertext)), AES.block_size)
    return plaintext.decode()

def get_timestamp():
    return str(datetime.now().strftime("%H:%M:%S"))

def make_log_message(timestamp: str, message: str) -> str:
    return f"""
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="log-tag">LOG</div>
            <div class="timestamp-class">{timestamp}</div>
            <div>{message}</div>
        </div>
    </div>
    """

def make_udp_message(timestamp: str, source: str, target: str, message: str) -> str:
    return f"""
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="udp-tag">UDP</div>
            <div class="timestamp-class">{timestamp}</div>
            <div class="name-tag">{source}</div>
            <div>sent a message to</div>
            <div class="name-tag">{target}:</div>
        </div>  
        <div class="global-message-content">{message}</div>
    </div>
    """

def make_tcp_message(timestamp: str, source: str, target: str, message: str) -> str:
    return f"""
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="tcp-tag">TCP</div>
            <div class="timestamp-class">{timestamp}</div>
            <div class="name-tag">{source}</div>
            <div>sent a message to</div>
            <div class="name-tag">{target}:</div>
        </div>  
        <div class="global-message-content">{message}</div>
    </div>
    """

def make_get_message(timestamp: str, source: str, target: str, message: str) -> str:
    return f"""
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="get-tag">GET</div>
            <div class="timestamp-class">{timestamp}</div>
            <div class="name-tag">{source}</div>
            <div>sent a message to</div>
            <div class="name-tag">{target}:</div>
        </div>  
        <div class="global-message-content">{message}</div>
    </div>
    """

def make_post_message(timestamp: str, source: str, target: str, message: str) -> str:
    return f"""
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="post-tag">POST</div>
            <div class="timestamp-class">{timestamp}</div>
            <div class="name-tag">{source}</div>
            <div>sent a message to</div>
            <div class="name-tag">{target}:</div>
        </div>  
        <div class="global-message-content">{message}</div>
    </div>
    """

def make_http_message(timestamp: str, source: str, target: str, message: str) -> str:
    return f"""
    <div class="global-message-class">
        <div class="global-message-meta">
            <div class="http-tag">HTTP</div>
            <div class="timestamp-class">{timestamp}</div>
            <div class="name-tag">{source}</div>
            <div>sent a message to</div>
            <div class="name-tag">{target}:</div>
        </div>  
        <div class="global-message-content">{message}</div>
    </div>
    """