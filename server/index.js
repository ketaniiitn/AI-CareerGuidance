const express = require('express');
const cors = require('cors');
const fileRoute = require('./fileroute');
const app = express();

// CORS setup
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/file', fileRoute);

const PORT = 5000;

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
