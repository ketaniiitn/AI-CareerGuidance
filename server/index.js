const express = require('express');
const cors = require('cors');

const fileRoute = require('./fileroute');
const app = express();


// CORS setup
app.use(cors());

app.use(express.json()); // handles JSON
app.use(express.urlencoded({ extended: true })); // handles URL-encoded data
app.use('/file',fileRoute);
const PORT = 5000;

app.get('/', (req, res) => {
 
    res.send('Server is running!');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });