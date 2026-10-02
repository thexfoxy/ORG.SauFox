// Direction for displayed numbers in Persian prose; never use for stored values.
window.SauFoxNumbers = Object.freeze({
  isolate(text) {
    return String(text).replace(
      /[\u2066-\u2068][^\u2069]*\u2069[%٪]?|[A-Za-z][A-Za-z0-9@._:/?=&%+#-]*|[-+−]?[0-9۰-۹٠-٩]+(?:[.,٫٬:/–-][0-9۰-۹٠-٩]+|[ \u00a0][0-9۰-۹٠-٩]+)*(?:[%٪+])?/g,
      (run) => {
        if (/^[A-Za-z]/.test(run)) return run;
        if (/^[\u2066-\u2068]/.test(run)) {
          return /[%٪]$/.test(run) ? run.slice(0, -2) + run.at(-1) + "\u2069" : run;
        }
        return `\u2066${run}\u2069`;
      }
    );
  },
});
