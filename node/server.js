import http from 'http';
const PORT = process.env.PORT;

const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<h1>Hello World</h1>`);
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});