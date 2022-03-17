const https = require("https");

const {
  GREENASH_BASE_URL,
  NOTIFY_FROM_EMAIL,
  NOTIFY_TO_EMAIL,
  SPARKPOST_AUTH_TOKEN
} = process.env;

const COMMENTS_QUEUE_FORM_NAME = "comments-queue";
const HTTPS_PORT = 443;
const SPARKPOST_API_HOSTNAME = "api.sparkpost.com";
const SPARKPOST_TRANSMISSION_API_ENDPOINT = "/api/v1/transmissions/";
const SUCCESS_HTTP_RESPONSE_CODES = new Set([200, 201, 204]);

const escapeHtml = unsafe => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Thanks to: https://stackoverflow.com/a/56122489
const doRequest = (options, data) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.setEncoding("utf8");
      const { statusCode } = res;
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        if (!responseBody) {
          if (SUCCESS_HTTP_RESPONSE_CODES.has(statusCode)) {
            resolve();
          }
          else {
            reject(new Error(
              `Response status code: ${statusCode} (empty response body)`
            ));
          }

          return;
        }

        try {
          const responseJson = JSON.parse(responseBody);

          if (SUCCESS_HTTP_RESPONSE_CODES.has(statusCode)) {
            resolve(responseJson);
          }
          else {
            const responseText = JSON.stringify(responseJson, null, 2);
            reject(new Error(
              `Response status code: ${statusCode}, response JSON: ${responseText}`
            ));
          }
        } catch (e) {
          console.error(`Tried calling JSON.parse on ${responseBody}, got ${e}`);
          reject(e);
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    if (data) {
      req.write(data);
    }

    req.end();
  });
};

const getCommonVars = event => {
  if (event.httpMethod !== "POST") {
    console.error(
      "Unable to send comment notification because event.httpMethod must be POST, " +
      `but it is ${event.httpMethod}`
    );
    return null;
  }

  if (!SPARKPOST_AUTH_TOKEN) {
    console.error(
      "Unable to send comment notification because SPARKPOST_AUTH_TOKEN env var is empty"
    );
    return null;
  }

  if (!NOTIFY_FROM_EMAIL) {
    console.error(
      "Unable to send comment notification because NOTIFY_FROM_EMAIL env var is empty"
    );
    return null;
  }

  if (!NOTIFY_TO_EMAIL) {
    console.error(
      "Unable to send comment notification because NOTIFY_TO_EMAIL env var is empty"
    );
    return null;
  }

  const body = JSON.parse(event.body);
  const payload = body.payload;
  const site = body.site;

  const formName = payload.form_name;
  if (!formName) {
    console.error("Unable to send comment notification because payload.form_name is empty");
    return null;
  }
  if (formName !== COMMENTS_QUEUE_FORM_NAME) {
    console.log(
      "Not sending comment notification because payload.form_name must be " +
      `${COMMENTS_QUEUE_FORM_NAME}, but it is ${payload.form_name}`
    );
    return null;
  }

  const siteName = site.name;
  if (!siteName) {
    console.error("Unable to send comment notification because site.name is empty");
    return null;
  }

  const siteDomain = GREENASH_BASE_URL;
  if (!siteDomain) {
    console.error("Unable to send comment notification because GREENASH_BASE_URL is empty");
    return null;
  }

  const id = payload.id;
  if (!id) {
    console.error("Unable to send comment notification because payload.id is empty");
    return null;
  }

  const date = payload.created_at;
  if (!date) {
    console.error("Unable to send comment notification because payload.created_at is empty");
    return null;
  }

  const data = payload.data;

  const title = data.title;
  if (!title) {
    console.error("Unable to send comment notification because data.title is empty");
    return null;
  }

  const path = data.path;
  if (!path) {
    console.error("Unable to send comment notification because data.path is empty");
    return null;
  }

  const name = data.name;
  if (!name) {
    console.error("Unable to send comment notification because data.name is empty");
    return null;
  }

  const email = data.email;
  if (!email) {
    console.error("Unable to send comment notification because data.email is empty");
    return null;
  }

  const url = data.url || "";

  const comment = data.comment;
  if (!comment) {
    console.error("Unable to send comment notification because data.comment is empty");
    return null;
  }

  return {
    sparkpostToken: SPARKPOST_AUTH_TOKEN,
    fromEmail: NOTIFY_FROM_EMAIL,
    toEmail: NOTIFY_TO_EMAIL,
    siteName,
    siteDomain,
    title,
    path,
    id,
    date,
    name,
    email,
    url,
    comment,
  };
}

const getNotifyMailSubject = (siteName, title) => {
  return `[${siteName}] comment on: ${title}`;
};

const getModerateUrl = (siteDomain, title, path, id, date, name, url, comment) => {
  return (
    `${siteDomain}/.netlify/functions/comment-moderate` +
    `?title=${encodeURIComponent(title)}` +
    `&id=${encodeURIComponent(id)}` +
    `&path=${encodeURIComponent(path)}` +
    `&date=${encodeURIComponent(date)}` +
    `&name=${encodeURIComponent(name)}` +
    `&url=${encodeURIComponent(url)}` +
    `&comment=${encodeURIComponent(comment)}`
  );
};

const getNotifyMailText = (name, email, url, comment, moderateUrl) => {
  return (
    `From: ${name} <${email}> ${url}\n\n` +
    "-----\n" +
    `${comment}\n` +
    "-----\n\n" +
    `Moderate: ${moderateUrl}\n`
  );
};

// Loosely based on:
// https://www.seancdavis.com/posts/netlify-function-sends-conditional-email/
const sendMail = async (
  sparkpostToken,
  fromEmail,
  toEmail,
  siteName,
  siteDomain,
  title,
  path,
  id,
  date,
  name,
  email,
  url,
  comment,
) => {
  const options = {
    hostname: SPARKPOST_API_HOSTNAME,
    port: HTTPS_PORT,
    path: SPARKPOST_TRANSMISSION_API_ENDPOINT,
    method: "POST",
    headers: {
      Authorization: sparkpostToken,
      "Content-Type": "application/json",
    }
  };

  const commentSafe = escapeHtml(comment);
  const moderateUrl = getModerateUrl(
    siteDomain, title, path, id, date, name, url, commentSafe
  );

  let data = {
    options: {
      open_tracking: false,
      click_tracking: false,
    },
    recipients: [
      {
        address: {
          email: toEmail,
        },
      },
    ],
    content: {
      from: {
        email: fromEmail,
      },
      subject: getNotifyMailSubject(siteName, title),
      text: getNotifyMailText(name, email, url, comment, moderateUrl),
    },
  };

  try {
    return await doRequest(options, JSON.stringify(data));
  } catch (e) {
    console.error(`SparkPost create transmission call failed: ${e}`);
    throw e;
  }
};

exports.handler = async (event, context) => {
  const vars = getCommonVars(event);

  if (!vars) {
    return;
  }

  const {
    sparkpostToken,
    fromEmail,
    toEmail,
    siteName,
    siteDomain,
    title,
    path,
    id,
    date,
    name,
    email,
    url,
    comment,
  } = vars;

  try {
    await sendMail(
      sparkpostToken,
      fromEmail,
      toEmail,
      siteName,
      siteDomain,
      title,
      path,
      id,
      date,
      name,
      email,
      url,
      comment,
    );
  } catch (e) { }
}
