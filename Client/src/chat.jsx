import React, { useEffect, useState } from "react";

const Chat = ({ socket, username, room }) => {
  const [currentMessage, setCurrentMessage] = useState("");
  const [messageList, setMessageList] = useState([]);

  const sendMessage = async () => {
    if (currentMessage.trim() === "") return;

    const messageData = {
      room: room,
      author: username,
      message: currentMessage,
      time:
        new Date().getHours() +
        ":" +
        new Date().getMinutes(),
    };

    await socket.emit("send_message", messageData);

    setMessageList((list) => [...list, messageData]);

    setCurrentMessage("");
  };

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setMessageList((list) => [...list, data]);
    });

    return () => {
      socket.off("receive_message");
    };
  }, [socket]);

  return (
    <div className="chat-window">
      <h2>Room: {room}</h2>

      <div className="chat-body">
        {messageList.map((msg, index) => (
          <div key={index} className="message">
            <strong>{msg.author}</strong>
            <p>{msg.message}</p>
            <small>{msg.time}</small>
          </div>
        ))}
      </div>

      <div className="chat-footer">
        <input
          type="text"
          placeholder="Type a message..."
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default Chat;