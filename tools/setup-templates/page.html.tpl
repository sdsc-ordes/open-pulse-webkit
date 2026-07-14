<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="__DESCRIPTION__" />
    <title>__TITLE__ — __PROJECT__ · Open Pulse</title>
    <script>
      (function () {
        try {
          document.documentElement.dataset.theme = localStorage.getItem('op-theme') === 'light' ? 'light' : 'dark';
          document.documentElement.dataset.mode = localStorage.getItem('op-mode') === 'expert' ? 'expert' : 'general';
        } catch (e) {}
      })();
    </script>
    <script type="module" src="/src/pages/__SLUG__.ts"></script>
  </head>
  <body></body>
</html>
