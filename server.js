const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const corsOptions = {
  origin: 'https://smart-retrieval-app.vercel.app',
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json());

// MongoDB Connection
const loadDB = async()=>{
  const db = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-chatbot');
  if(db){
    console.log('database connected')
  }
}
loadDB()


// User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  preferredLanguage: { type: String, default: 'en' },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String },
    lastUpdated: { type: Date }
  },
  createdAt: { type: Date, default: Date.now }
});

// Chat Schema
const ChatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'New Chat' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    language: { type: String, default: 'en' }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Chat = mongoose.model('Chat', ChatSchema);

// Auth middleware
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Token is not valid' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};

// Language detection function
const detectLanguage = (text) => {
  // Simple language detection - in production use proper detection service
  const banglaPattern = /[\u0980-\u09FF]/;
  const arabicPattern = /[\u0600-\u06FF]/;
  const chinesePattern = /[\u4e00-\u9fff]/;
  
  if (banglaPattern.test(text)) return 'bn';
  if (arabicPattern.test(text)) return 'ar';
  if (chinesePattern.test(text)) return 'zh';
  return 'en';
};

// AI Response Generator (Mock - replace with actual AI service)
const generateAIResponse = async (message, language = 'en') => {
  // Mock responses for different types of queries
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('cheesecake') || lowerMessage.includes('dessert')) {
    return {
      content: "I found several great places for cheesecake near you! Here are the top recommendations:\n\n🍰 **Sweet Dreams Bakery** - 2.3 miles away\n- Fresh New York style cheesecake\n- Rating: 4.8/5\n- Special offer: 20% off today!\n\n🍰 **Cafe Delight** - 1.8 miles away\n- Artisanal cheesecakes\n- Rating: 4.6/5\n- Free delivery on orders over $25",
      recommendations: [
        { name: "Sweet Dreams Bakery", distance: "2.3 miles", rating: 4.8, offer: "20% off today" },
        { name: "Cafe Delight", distance: "1.8 miles", rating: 4.6, offer: "Free delivery over $25" }
      ]
    };
  }
  
  if (lowerMessage.includes('deal') || lowerMessage.includes('offer') || lowerMessage.includes('discount')) {
    return {
      content: "Here are the best deals available right now:\n\n💰 **Flash Sale Alert!**\n- 50% off electronics at TechStore\n- Buy 2 get 1 free at Fashion Hub\n- Free shipping on orders over $50\n\n🔥 **Limited Time Offers:**\n- 30% off restaurant meals via FoodApp\n- 25% cashback on grocery shopping",
      recommendations: [
        { name: "TechStore", offer: "50% off electronics", expires: "24 hours" },
        { name: "Fashion Hub", offer: "Buy 2 get 1 free", expires: "48 hours" },
        { name: "FoodApp", offer: "30% off meals", expires: "This week" }
      ]
    };
  }
  
  if (lowerMessage.includes('restaurant') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
    return {
      content: "I found some amazing restaurants near you:\n\n🍕 **Pizza Palace** - 1.2 miles\n- Authentic Italian pizza\n- Rating: 4.7/5\n- 15% off for new customers\n\n🍣 **Sushi Zen** - 2.1 miles\n- Fresh sushi and sashimi\n- Rating: 4.9/5\n- Happy hour: 3-6 PM daily",
      recommendations: [
        { name: "Pizza Palace", cuisine: "Italian", distance: "1.2 miles", rating: 4.7 },
        { name: "Sushi Zen", cuisine: "Japanese", distance: "2.1 miles", rating: 4.9 }
      ]
    };
  }
  
  // Default response
  return {
    content: "I'm here to help you find the best deals, recommendations, and local businesses! You can ask me about:\n\n• Finding nearby restaurants, shops, or services\n• Getting the latest deals and offers\n• Personalized recommendations based on your preferences\n• Local business information and reviews\n\nWhat would you like to explore today?",
    recommendations: []
  };
};

// Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Please provide all required fields' });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: '7d'
    });
    
    res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'fallback-secret', {
      expiresIn: '7d'
    });
    
    res.json({
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chat Routes
app.get('/api/chats', authMiddleware, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id })
      .select('title createdAt updatedAt')
      .sort({ updatedAt: -1 });
    
    res.json(chats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/chats', authMiddleware, async (req, res) => {
  try {
    const chat = new Chat({
      userId: req.user._id,
      title: 'New Chat',
      messages: []
    });
    
    await chat.save();
    res.status(201).json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/chats/:chatId', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOne({ 
      _id: req.params.chatId, 
      userId: req.user._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/chats/:chatId/messages', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const chat = await Chat.findOne({ 
      _id: req.params.chatId, 
      userId: req.user._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Detect language
    const detectedLanguage = detectLanguage(message);
    
    // Add user message
    const userMessage = {
      role: 'user',
      content: message.trim(),
      language: detectedLanguage,
      timestamp: new Date()
    };
    
    chat.messages.push(userMessage);
    
    // Generate AI response
    const aiResponse = await generateAIResponse(message, detectedLanguage);
    
    const assistantMessage = {
      role: 'assistant',
      content: aiResponse.content,
      language: detectedLanguage,
      timestamp: new Date()
    };
    
    chat.messages.push(assistantMessage);
    
    // Update chat title if it's the first message
    if (chat.messages.length === 2) {
      chat.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }
    
    chat.updatedAt = new Date();
    await chat.save();
    
    res.json({
      userMessage,
      assistantMessage,
      recommendations: aiResponse.recommendations || []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/chats/:chatId/title', authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const chat = await Chat.findOneAndUpdate(
      { _id: req.params.chatId, userId: req.user._id },
      { title: title.trim(), updatedAt: new Date() },
      { new: true }
    );
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ message: 'Chat title updated successfully', chat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/chats/:chatId', authMiddleware, async (req, res) => {
  try {
    const chat = await Chat.findOneAndDelete({ 
      _id: req.params.chatId, 
      userId: req.user._id 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json({ message: 'Chat deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User profile route
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    // Ensure consistent response format
    const userResponse = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      preferredLanguage: user.preferredLanguage,
      location: user.location,
      createdAt: user.createdAt
    };
    
    res.json(userResponse);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const { name, preferredLanguage } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, preferredLanguage },
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User location routes
app.post('/api/user/location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude, address } = req.body;
    
    // Validate location data
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { 
        location: {
          latitude,
          longitude,
          address: address || `${latitude}, ${longitude}`,
          lastUpdated: new Date()
        }
      },
      { new: true }
    ).select('-password');
    
    res.json({ 
      message: 'Location saved successfully',
      location: user.location 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/user/location', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('location');
    
    if (!user.location || !user.location.latitude) {
      return res.status(404).json({ error: 'No location data found' });
    }
    
    res.json(user.location);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/user/location', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      { $unset: { location: 1 } },
      { new: true }
    );
    
    res.json({ message: 'Location data deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});