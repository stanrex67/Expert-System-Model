export const handleConversation = (intent, userName = "there") => {
  switch (intent) {

    case "GREETING":
      return `👋 Hello ${userName}! I'm your virtual library assistant.\n\nHow can I assist you today?`;

    case "SMALL_TALK":
      return `😊 I'm here to help you find books, recommend resources, and guide you through the library.\n\nYou can ask me things like:\n- Find books on programming\n- Recommend books for me\n- Where is this book located`;

    case "GENERAL_HELP":
      return `📚 You can ask me to:\n- Find books by subject, title, or author\n- Recommend books for your study\n- Show where books are located in the library\n\nTry: "Find books on data science"`;

    default:
      return null;
  }
};