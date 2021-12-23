const https = require("https");
const querystring = require("querystring");

const {
  GITHUB_AUTH_TOKEN,
  GITHUB_REPO,
  GITHUB_USER,
  NETLIFY_AUTH_TOKEN
} = process.env;

const GITHUB_API_HOSTNAME = "api.github.com";
const HTTPS_PORT = 443;
const NETLIFY_API_HOSTNAME = "api.netlify.com";
const SUCCESS_HTTP_RESPONSE_CODES = new Set([200, 201, 204]);

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
    return { err: { statusCode: 405, body: "Method Not Allowed" } };
  }

  if (!NETLIFY_AUTH_TOKEN) {
    console.error(
      "Unable to approve or delete comment because NETLIFY_AUTH_TOKEN env var is empty"
    );
    return { err: { statusCode: 500, body: "Internal Server Error" } };
  }

  const params = querystring.parse(event.body);

  const token = params.token;
  if (!token) {
    return { err: { statusCode: 400, body: "Missing token" } };
  }

  if (token !== NETLIFY_AUTH_TOKEN) {
    return { err: { statusCode: 401, body: "Unauthorized" } };
  }

  const action = params.action;
  if (!action) {
    return { err: { statusCode: 400, body: "Missing action" } };
  }

  const id = params.id;
  if (!id) {
    return { err: { statusCode: 400, body: "Missing id" } };
  }

  return {
    vars: {
      netlifyToken: NETLIFY_AUTH_TOKEN,
      params,
      token,
      action,
      id,
    }
  };
};

const getApproveVars = params => {
  if (!GITHUB_AUTH_TOKEN) {
    console.error(
      "Unable to approve comment because GITHUB_AUTH_TOKEN env var is empty"
    );
    return { err: { statusCode: 500, body: "Internal Server Error" } };
  }
  if (!GITHUB_USER) {
    console.error(
      "Unable to approve comment because GITHUB_USER env var is empty"
    );
    return { err: { statusCode: 500, body: "Internal Server Error" } };
  }
  if (!GITHUB_REPO) {
    console.error(
      "Unable to approve comment because GITHUB_REPO env var is empty"
    );
    return { err: { statusCode: 500, body: "Internal Server Error" } };
  }

  const path = params.path;
  if (!path) {
    return { err: { statusCode: 400, body: "Missing path" } };
  }

  const title = params.title;
  if (!title) {
    return { err: { statusCode: 400, body: "Missing title" } };
  }

  const date = params.date;
  if (!date) {
    return { err: { statusCode: 400, body: "Missing date" } };
  }

  const name = params.name;
  if (!name) {
    return { err: { statusCode: 400, body: "Missing name" } };
  }

  const url = params.url || "";

  const comment = params.comment;
  if (!comment) {
    return { err: { statusCode: 400, body: "Missing comment" } };
  }

  return {
    vars: {
      githubToken: GITHUB_AUTH_TOKEN,
      githubUser: GITHUB_USER,
      githubRepo: GITHUB_REPO,
      path,
      title,
      date,
      name,
      url,
      comment,
    }
  };
};

// Based on: https://github.com/philhawksworth/jamstack-comments-engine

const purgeComment = async (id, netlifyToken) => {
  const options = {
    hostname: NETLIFY_API_HOSTNAME,
    port: HTTPS_PORT,
    path: `/api/v1/submissions/${id}?access_token=${netlifyToken}`,
    method: "DELETE",
  };

  try {
    await doRequest(options);
    console.log("Comment deleted from queue");
  } catch (e) {
    console.error(`Netlify delete submission call failed: ${e}`);
    throw e;
  }
};

const getGithubContentsApiEndpointForPath = (githubUser, githubRepo, path) => {
  return `/repos/${githubUser}/${githubRepo}/contents/${path}.11tydata.json`;
}

const getGithubApiHeaderToken = (githubUser, githubToken) => {
  return Buffer.from(`${githubUser}:${githubToken}`).toString("base64");
}

// Based on:
// https://healeycodes.com/adding-comments-to-gatsby-with-netlify-and-github
const getExistingCommentsFile = async (githubToken, githubUser, githubRepo, path) => {
  const endpoint = getGithubContentsApiEndpointForPath(githubUser, githubRepo, path);
  const headerToken = getGithubApiHeaderToken(githubUser, githubToken);

  const options = {
    hostname: GITHUB_API_HOSTNAME,
    port: HTTPS_PORT,
    path: endpoint,
    method: "GET",
    headers: {
      Authorization: `Basic ${headerToken}`,
      "User-Agent": githubUser,
    }
  };

  try {
    return await doRequest(options);
  } catch (e) {
    console.error(`Github get contents call failed: ${e}`);
    throw e;
  }
};

const getExistingJson = existingFile => {
  try {
    return JSON.parse(
      Buffer.from(existingFile.content, "base64").toString("utf-8")
    );
  } catch (e) {
    console.error(`JSON parse of existing comment file failed: ${e}`);
    throw e;
  }
};

const getExistingComments = existingJson => {
  if (!("comments" in existingJson)) {
    return [];
  }

  if (!Array.isArray(existingJson.comments)) {
    const msg = `existingJson.comments is not an array: ${existingJson.comments}`;
    console.error(msg);
    throw new Error(msg);
  }

  return [...existingJson.comments];
};

const getNewComments = (existingComments, date, name, url, comment) => {
  let newComment = {
    date,
    name,
  };

  if (url) {
    newComment.url = url;
  }

  newComment.comment = comment;

  return [...existingComments, newComment];
};

const getNewJson = (existingJson, newComments) => {
  return { ...existingJson, comments: newComments };
};

const putNewCommentsFile = async (
  githubToken, githubUser, githubRepo, path, title, date, name, newJson, existingSha
) => {
  const endpoint = getGithubContentsApiEndpointForPath(githubUser, githubRepo, path);
  const headerToken = getGithubApiHeaderToken(githubUser, githubToken);

  const options = {
    hostname: GITHUB_API_HOSTNAME,
    port: HTTPS_PORT,
    path: endpoint,
    method: "PUT",
    headers: {
      Authorization: `Basic ${headerToken}`,
      "User-Agent": githubUser,
    }
  };

  const newJsonStr = JSON.stringify(newJson, null, 2);
  const commitMsg =
    `Comment on: ${title}\n\n` +
    `By: ${name}\n` +
    `At: ${date}\n\n` +
    `Published by the comment bot`;
  let data = {
    message: commitMsg,
    content: Buffer.from(`${newJsonStr}\n`).toString("base64"),
  };

  if (existingSha) {
    data.sha = existingSha;
  }

  try {
    return await doRequest(options, JSON.stringify(data));
  } catch (e) {
    console.error(`Github put contents call failed: ${e}`);
    throw e;
  }
};

const approveComment = async (
  githubToken,
  githubUser,
  githubRepo,
  path,
  title,
  date,
  name,
  url,
  comment,
) => {
  try {
    let existingSha;
    let existingJson;
    let existingComments;

    try {
      const existingFile = await getExistingCommentsFile(
        githubToken, githubUser, githubRepo, path
      );
      existingSha = existingFile.sha;
      existingJson = getExistingJson(existingFile);
      existingComments = getExistingComments(existingJson);
    } catch (e) {
      existingSha = null;
      existingJson = {};
      existingComments = [];
    }

    const newComments = getNewComments(existingComments, date, name, url, comment);
    const newJson = getNewJson(existingJson, newComments);

    await putNewCommentsFile(
      githubToken, githubUser, githubRepo, path, title, date, name, newJson, existingSha
    );

    return { statusCode: 200, body: "Comment approved" };
  }
  catch (e) {
    return { statusCode: 400, body: "Failed to approve comment" };
  }
};

const deleteComment = async (id, netlifyToken) => {
  try {
    await purgeComment(id, netlifyToken);
    return { statusCode: 200, body: "Comment deleted" };
  } catch (e) {
    return { statusCode: 400, body: "Failed to delete comment" };
  }
};

exports.handler = async (event, context) => {
  const commonVars = getCommonVars(event);

  if (commonVars.err) {
    return commonVars.err;
  }

  const { netlifyToken, params, token, action, id } = commonVars.vars;

  if (action === "approve") {
    const approveVars = getApproveVars(params);

    if (approveVars.err) {
      return approveVars.err;
    }

    const {
      githubToken,
      githubUser,
      githubRepo,
      path,
      title,
      date,
      name,
      url,
      comment,
    } = approveVars.vars;

    return approveComment(
      githubToken,
      githubUser,
      githubRepo,
      path,
      title,
      date,
      name,
      url,
      comment,
    );
  }
  else if (action === "delete") {
    return deleteComment(id, netlifyToken);
  }

  return {
    statusCode: 400,
    body: `Invalid action "${action}", must be either "approve" or "delete"`,
  };
}
