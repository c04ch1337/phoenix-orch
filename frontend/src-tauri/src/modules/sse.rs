use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::{
    net::{TcpListener, TcpStream},
    sync::broadcast::{self, Sender, Receiver},
    io::AsyncWriteExt,
};
use serde::{Serialize, Deserialize};

/// Event data structure for SSE events
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SseEvent {
    pub event: String,
    pub data: String,
}

/// SSE Server that manages real-time event streaming
/// This replaces all WebSocket functionality with Server-Sent Events
pub struct SseServer {
    event_sender: Sender<SseEvent>,
    connections: Arc<Mutex<HashMap<String, Vec<TcpStream>>>>,
}

impl SseServer {
    /// Create a new SSE server
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(100);
        
        Self {
            event_sender: sender,
            connections: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Emit an event to all connected clients
    pub fn emit_event(&self, event: &str, data: &str) -> Result<(), String> {
        let sse_event = SseEvent {
            event: event.to_string(),
            data: data.to_string(),
        };
        
        self.event_sender.send(sse_event)
            .map_err(|e| format!("Failed to emit event: {}", e))?;
            
        Ok(())
    }
    
    /// Subscribe to events
    pub fn subscribe(&self) -> Receiver<SseEvent> {
        self.event_sender.subscribe()
    }
    
    /// Add a new client connection
    pub fn add_connection(&self, client_id: &str, stream: TcpStream) -> Result<(), String> {
        let mut connections = self.connections.lock()
            .map_err(|_| "Failed to lock connections".to_string())?;
            
        let client_connections = connections.entry(client_id.to_string())
            .or_insert_with(Vec::new);
            
        client_connections.push(stream);
        
        Ok(())
    }
    
    /// Remove a client connection
    pub fn remove_connection(&self, client_id: &str) -> Result<(), String> {
        let mut connections = self.connections.lock()
            .map_err(|_| "Failed to lock connections".to_string())?;
            
        connections.remove(client_id);
        
        Ok(())
    }
}

/// Start the SSE server on the specified port
pub async fn start_server(port: u16) -> Result<SseServer, String> {
    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr).await
        .map_err(|e| format!("Failed to bind SSE server to {}: {}", addr, e))?;
        
    let server = SseServer::new();
    let server_clone = server.clone();
    
    // Start listener in a background task
    tokio::spawn(async move {
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let server = server_clone.clone();
                    let mut receiver = server.subscribe();
                    
                    tokio::spawn(async move {
                        // Send SSE headers
                        let mut stream = stream;
                        let headers = "HTTP/1.1 200 OK\r\n\
                                      Content-Type: text/event-stream\r\n\
                                      Cache-Control: no-cache\r\n\
                                      Connection: keep-alive\r\n\
                                      Access-Control-Allow-Origin: *\r\n\
                                      \r\n";
                        
                        if let Err(e) = stream.write_all(headers.as_bytes()).await {
                            eprintln!("Failed to write SSE headers: {}", e);
                            return;
                        }
                        
                        // Process events
                        while let Ok(event) = receiver.recv().await {
                            let message = format!(
                                "event: {}\ndata: {}\n\n",
                                event.event, event.data
                            );
                            
                            if let Err(e) = stream.write_all(message.as_bytes()).await {
                                eprintln!("Failed to write SSE event: {}", e);
                                break;
                            }
                            
                            if let Err(e) = stream.flush().await {
                                eprintln!("Failed to flush SSE stream: {}", e);
                                break;
                            }
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Failed to accept SSE connection: {}", e);
                }
            }
        }
    });
    
    Ok(server)
}

// Clone implementation for SseServer
impl Clone for SseServer {
    fn clone(&self) -> Self {
        Self {
            event_sender: self.event_sender.clone(),
            connections: self.connections.clone(),
        }
    }
}