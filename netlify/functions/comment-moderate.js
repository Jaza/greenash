const escapeHtml = unsafe => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const title = escapeHtml(event.queryStringParameters.title || "");
  if (!title) {
    return { statusCode: 400, body: "Missing title" };
  }
  const path = escapeHtml(event.queryStringParameters.path || "");
  if (!path) {
    return { statusCode: 400, body: "Missing path" };
  }
  const id = escapeHtml(event.queryStringParameters.id || "");
  if (!id) {
    return { statusCode: 400, body: "Missing id" };
  }
  const date = escapeHtml(event.queryStringParameters.date || "");
  if (!date) {
    return { statusCode: 400, body: "Missing date" };
  }
  const name = escapeHtml(event.queryStringParameters.name || "");
  if (!name) {
    return { statusCode: 400, body: "Missing name" };
  }
  const url = escapeHtml(event.queryStringParameters.url || "");
  const comment = escapeHtml(event.queryStringParameters.comment || "");
  if (!comment) {
    return { statusCode: 400, body: "Missing comment" };
  }

  const css = (
    '<style type="text/css">\n' +
    "body {\n" +
    "  margin: 1em;\n" +
    "}\n" +
    "h1 {\n" +
    "  font-family: sans-serif;\n" +
    "}\n" +
    "input[type=text], input[type=email], input[type=password], textarea {\n" +
    "  width: 98%;\n" +
    "}\n" +
    "input[type=submit] {\n" +
    "  padding: 0.8em;\n" +
    "  color: white;\n" +
    "  background-color: #666;\n" +
    "  font-weight: bold;\n" +
    "  border: 0;\n" +
    "  font-size: 1em;\n" +
    "  margin-right: 0.8em;\n" +
    "}\n" +
    "#approve {\n" +
    "  background-color: #090;\n" +
    "}\n" +
    "#delete {\n" +
    "  background-color: #900;\n" +
    "}\n" +
    "</style>\n"
  );

  const form = (
    '<form action="/.netlify/functions/comment-action" method="POST">\n' +
    '<p><label for="path">Path:</label></p>\n' +
    `<p><input type="text" name="path" id="path" value="${path}"></p>\n` +
    '<p><label for="title">Title:</label></p>\n' +
    `<p><input type="text" name="title" id="title" value="${title}"></p>\n` +
    '<p><label for="id">ID:</label></p>\n' +
    `<p><input type="text" name="id" id="id" value="${id}"></p>\n` +
    '<p><label for="date">Date:</label></p>\n' +
    `<p><input type="text" name="date" id="date" value="${date}"></p>\n` +
    '<p><label for="name">Name:</label></p>\n' +
    `<p><input type="text" name="name" id="name" value="${name}"></p>\n` +
    '<p><label for="url">URL:</label></p>\n' +
    `<p><input type="text" name="url" id="url" value="${url}"></p>\n` +
    '<p><label for="comment">Comment:</label></p>\n' +
    `<p><textarea name="comment" id="comment">${comment}</textarea></p>\n` +
    `<input type="text" name="username" value="admin" style="display: none">\n` +
    '<p><label for="token">Token:</label></p>\n' +
    '<p><input type="password" name="token" id="token"></p>\n' +
    "<p>\n" +
    '<input type="submit" value="approve" name="action" id="approve">\n' +
    '<input type="submit" value="delete" name="action" id="delete">\n' +
    "</p>\n" +
    "</form>\n"
  );

  const responseBody = (
    "<!doctype html>\n" +
    '<html lang="en-AU">\n' +
    "<head>\n" +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    `<title>Moderate comment on: ${title} - GreenAsh</title>\n` +
    '<link rel="shortcut icon" href="/favicon.ico" type="image/vnd.microsoft.icon">\n' +
    css +
    "</head>\n" +
    "<body>\n" +
    `<h1>Moderate comment on: ${title}</h1>\n` +
    form +
    "</body>\n" +
    "</html>\n"
  );

  return {
    statusCode: 200,
    body: responseBody,
  };
};
