const { DateTime } = require("luxon");
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const Image = require("@11ty/eleventy-img");
const Nunjucks = require("nunjucks");

const params = require("./_data/params");

module.exports = function(eleventyConfig) {
  const THOUGHTS_TOPICS_PREFIX = "thoughtstopics/";
  const THOUGHTS_TOPICS_PATH = "/thoughts/topics/";

  const TAG_CLOUD_MIN_SIZE = 0.75;
  const TAG_CLOUD_ROUNDING_FACTOR = 10e6;

  const nunjucksEnvironment = new Nunjucks.Environment(
    new Nunjucks.FileSystemLoader("_includes")
  );

  // Lets us access template variables dynamically in Nunjucks, via
  // {{ getContext()["someVar"] }}
  nunjucksEnvironment.addGlobal('getContext', function() {
    return this.ctx;
  });

  eleventyConfig.setLibrary("njk", nunjucksEnvironment);

  // Eleventy Navigation https://www.11ty.dev/docs/plugins/navigation/
  eleventyConfig.addPlugin(eleventyNavigationPlugin);

  // Merge data instead of overriding
  // https://www.11ty.dev/docs/data-deep-merge/
  eleventyConfig.setDataDeepMerge(true);

  eleventyConfig.addFilter("dateYM", dateObj => {
    return DateTime.fromJSDate(dateObj).toFormat("yyyy/LL");
  });

  eleventyConfig.addFilter("dateDM", dateObj => {
    return DateTime.fromJSDate(dateObj).toFormat("d LLL");
  });

  eleventyConfig.addFilter("dateY", dateObj => {
    return DateTime.fromJSDate(dateObj).toFormat("yyyy");
  });

  eleventyConfig.addFilter("dateISO", dateObj => {
    return DateTime.fromJSDate(dateObj).setZone("utc").toString();
  });

  // Thanks to: https://stackoverflow.com/a/6234804
  const escapeHtml = unsafe => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Convert line breaks into <p> and <br> in an intelligent fashion.
  // Originally based on: https://ma.tt/scripts/autop/
  //
  // Was ported from the Drupal _filter_autop() function:
  // https://api.drupal.org/api/function/_filter_autop
  //
  // Then lived as a custom Django filter (by yours truly), before being
  // ported to 11ty
  eleventyConfig.addFilter("autop", value => {
    // All block level tags
    const block = "(?:table|thead|tfoot|caption|colgroup|tbody|tr|td|th|div|dl|dd|dt|ul|ol|li|pre|select|form|blockquote|address|p|h[1-6]|hr)";

    // Split at <pre>, <script>, <style> and </pre>, </script>, </style> tags.
    // We don't apply any processing to the contents of these tags to avoid messing
    // up code. We look for matched pairs and allow basic nesting. For example:
    // "processed <pre> ignored <script> ignored </script> ignored </pre> processed"
    const chunks = value.split(/(<\/?(?:pre|script|style|object)[^>]*>)/);
    let ignore = false;
    let ignoretag = "";
    let output = "";

    for (const [i, chunk] of chunks.entries()) {
      let newChunk = chunk;
      const prevIgnore = ignore;

      if (i % 2) {
        // Opening or closing tag?
        const isOpen = newChunk[1] !== "/";
        const tag = newChunk.substring(2 - (isOpen ? 1 : 0)).split(/[ >]/, 2)[0];

        if (!ignore) {
          if (isOpen) {
            ignore = true;
            ignoretag = tag;
          }
        }
        // Only allow a matching tag to close it.
        else if (!isOpen && ignoretag === tag) {
          ignore = false;
          ignoretag = "";
        }
      }
      else if (!ignore) {
        newChunk = newChunk.replace(/\n*$/g, "") + "\n\n"; // just to make things a little easier, pad the end
        newChunk = newChunk.replace(/<br \/>\s*<br \/>/g, "\n\n");
        newChunk = newChunk.replace(new RegExp("(<" + block + "[^>]*>)", "g"), "\n$1"); // Space things out a little
        newChunk = newChunk.replace(new RegExp("(<\/" + block + ">)", "g"), "$1\n\n"); // Space things out a little
        newChunk = newChunk.replace(/\n\n+/g, "\n\n"); // take care of duplicates
        newChunk = newChunk.replace(/\n?(.+?)(?:\n\s*\n|$)/g, "<p>$1</p>\n"); // make paragraphs, including one at the end
        newChunk = newChunk.replace(/<p>(<li.+?)<\/p>/g, "$1"); // problem with nested lists
        newChunk = newChunk.replace(/<p><blockquote([^>]*)>/g, "<blockquote$1><p>");
        newChunk = newChunk.replace(/<\/blockquote><\/p>/g, "</p></blockquote>");
        newChunk = newChunk.replace(/<p>\s*<\/p>\n?/g, ""); // under certain strange conditions it could create a P of entirely whitespace
        newChunk = newChunk.replace(new RegExp("<p>\s*(<\/?" + block + "[^>]*>)", "g"), "$1");
        newChunk = newChunk.replace(new RegExp("(<\/?" + block + "[^>]*>)\s*</p>", "g"), "$1");
        newChunk = newChunk.replace(/(?<!<br \/>)\s*\n/g, "<br />\n"); // make line breaks
        newChunk = newChunk.replace(new RegExp("(<\/?" + block + "[^>]*>)\s*<br \/>", "g"), "$1");
        newChunk = newChunk.replace(/<br \/>(\s*<\/?(?:p|li|div|th|pre|td|ul|ol)>)/g, "$1");
        newChunk = newChunk.replace(/&([^#])(?![A-Za-z0-9]{1,8};)/g, "&amp;$1");
      }

      // Extra (not ported from Drupal) to escape the contents of code blocks.
      const codeStart = newChunk.search(/^<code>/) !== -1;
      const codeEnd = newChunk.search(/(.*?)<\/code>$/) !== -1;

      if (prevIgnore && ignore) {
        if (codeStart) {
          newChunk = newChunk.replace(/^<code>(.+)/g, "$1");
        }

        if (codeEnd) {
          newChunk = newChunk.replace(/(.*?)<\/code>$/g, "$1");
        }

        newChunk = newChunk.replace(/<\\\/pre>/g, "</pre>");
        newChunk = escapeHtml(newChunk);

        if (codeStart) {
          newChunk = "<code>" + newChunk;
        }

        if (codeEnd) {
          newChunk += "</code>";
        }
      }

      newChunk = newChunk.replace(/<blockquote([^>]*)>/g, '<section class="wideflex-wrapper"><blockquote$1>');
      newChunk = newChunk.replace(/<\/blockquote>/g, "</blockquote></section>");

      newChunk = newChunk.replace(/<blockquote([^>]*)>/g, '<section class="wideflex-wrapper"><blockquote$1>');
      newChunk = newChunk.replace(/<\/blockquote>/g, "</blockquote></section>");

      output += newChunk;
    }

    output = output.replace(/<pre([^>]*)><code>/g, '<section class="wideflex-wrapper"><pre$1><code>');
    output = output.replace(/<\/code><\/pre>/g, "</code></pre></section>");

    return output;
  });

  const thumbnailRegex = /\[thumbnail ([^ \]]+)( ([^\]]+))?\]/g;

  eleventyConfig.addNunjucksAsyncFilter("inlineThumbnails", (value, callback) => {
    if (!params.uploadsBaseURL) {
      callback(null, value);
      return;
    }

    const matches = value.matchAll(thumbnailRegex);
    let toReplace = [];

    // Thanks to: https://stackoverflow.com/a/47270640
    const mapIterator = function* (iterator, mapping) {
      for (let i of iterator) {
        yield mapping(i);
      }
    };

    // Originally used setTimeout, but now I've seen the light of promises:
    // https://github.com/11ty/eleventy/issues/1450
    Promise.all(mapIterator(matches, async match => {
      const placeholder = match[0];
      const filename = match[1];
      const ext = filename.split('.')[1];
      const src = `https:${params.uploadsBaseURL}images/${filename}`;
      const title = match[3];

      const thumbnailOptions = {
        widths: [680],
        formats: [ext],
        outputDir: "./_site/img/",
      };

      try {
        const metadata = await Image(src, thumbnailOptions);

        const imageAttributes = {
          alt: title,
          loading: "lazy",
          decoding: "async",
        };

        const imgHtmlFragment = Image.generateHTML(metadata, imageAttributes);
        const imgHtml = "<figure>" + imgHtmlFragment + (title ? `<figcaption>${title}</figcaption>` : "") + "</figure>";

        toReplace.push({
          placeholder,
          imgHtml,
        });
      } catch (error) {
        console.error(error);
      }
    })).then(() => {
      let newValue = value;

      for (let {placeholder, imgHtml} of toReplace) {
        newValue = newValue.replace(placeholder, imgHtml);
      }

      callback(null, newValue);
    });
  });

  const getPageByUrl = (collection, pageURL) => {
    const pages = collection.filter(item => {
      return item.url === pageURL;
    });

    return pages.length ? pages[0] : null;
  };

  eleventyConfig.addFilter("getTopicsForThought", (tags, collection) => {
    if (!tags) {
      return [];
    }

    return tags
      .filter(tag => tag.startsWith(THOUGHTS_TOPICS_PREFIX))
      .map(tag => tag.replace(THOUGHTS_TOPICS_PREFIX, ""))
      .filter(tag => getPageByUrl(collection, THOUGHTS_TOPICS_PATH + tag + "/"))
      .map(tag => {
        return {
          url: THOUGHTS_TOPICS_PATH + tag + "/",
          title: getPageByUrl(collection, THOUGHTS_TOPICS_PATH + tag + "/").data.title
        };
      });
  });

  // Thanks to: https://github.com/11ty/eleventy/issues/316
  eleventyConfig.addCollection("thoughtsByYear", (collection) => {
    let contentByDate = {};

    collection.getAllSorted().forEach(function(item) {
      if ("date" in item.data) {
        let tags = item.data.tags;

        if (typeof tags === "string") {
          tags = [tags];
        }

        if (tags && tags.includes("thoughts")) {
          let itemDate = item.data.date;
          const date = DateTime.fromJSDate(itemDate).toFormat("yyyy");

          if (!(date in contentByDate)) {
            contentByDate[date] = [];
          }

          contentByDate[date].push(item);
        }
      }
    });

    for (const [key, value] of Object.entries(contentByDate)) {
      contentByDate[key] = value.sort((a, b) => {
        return b.date - a.date;
      });
    }

    return contentByDate;
  });

  eleventyConfig.addFilter("getThoughtsTopicsTagCloud", (collection) => {
    if (!collection) {
      return [];
    }

    let minCount = 0;
    let maxCount = 0;

    const topicsWithCount = collection.map(item => {
      const tag = item.url.replace(THOUGHTS_TOPICS_PATH, "").replace("/", "");
      const itemCount = item.data.items.length;

      if (!minCount || itemCount < minCount) {
        minCount = itemCount;
      }

      if (itemCount > maxCount) {
        maxCount = itemCount;
      }

      return {
        key: THOUGHTS_TOPICS_PREFIX + tag,
        url: item.url,
        title: item.data.title,
        itemCount,
      };
    });

    const constant = Math.log(maxCount - (minCount - 1));

    return topicsWithCount.map(item => {
      const size = (
        (Math.log(item.itemCount - (minCount - 1)) / constant) + TAG_CLOUD_MIN_SIZE
      );

      const sizeRounded = (
        Math.round(
          (size + Number.EPSILON) * TAG_CLOUD_ROUNDING_FACTOR
        ) / TAG_CLOUD_ROUNDING_FACTOR
      );

      return {
        ...item,
        size: sizeRounded,
      };
    }).sort((a, b) => {
      return a.title.localeCompare(b.title);
    });
  });

  // Don't process folders with static assets e.g. images
  eleventyConfig.addPassthroughCopy({"static/favicon.ico": "favicon.ico"});
  eleventyConfig.addPassthroughCopy({"static/_redirects": "_redirects"});
  eleventyConfig.addPassthroughCopy({"static/css": "css"});
  eleventyConfig.addPassthroughCopy({"static/img": "img"});
  eleventyConfig.addPassthroughCopy({"static/js": "js"});

  return {
    templateFormats: ["html"],

    // If your site lives in a different subdirectory, change this.
    // Leading or trailing slashes are all normalized away, so don’t worry about it.
    // If you don’t have a subdirectory, use "" or "/" (they do the same thing)
    // This is only used for URLs (it does not affect your file structure)
    pathPrefix: "/",

    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: ".",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
