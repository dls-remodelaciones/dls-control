import { test } from "node:test";
import assert from "node:assert/strict";
import { scriptsLocales } from "../lib/scripts-sitio";

const SITIO = "https://www.dlsremodelaciones.cl";

test("encuentra los scripts propios con su versión y descarta los externos", () => {
  const html = `
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>
    <script src="./dls-lead.js?v=12"></script>
    <script defer src='/dls-chatbot.js?v=3'></script>
    <script>var x = 1;</script>
    <script type="text/javascript" src="https://dlsremodelaciones.cl/otro.js"></script>
    <script src="dls-lead.js?v=12"></script>`;
  assert.deepEqual(scriptsLocales(html, SITIO), [
    "https://www.dlsremodelaciones.cl/dls-lead.js?v=12",
    "https://www.dlsremodelaciones.cl/dls-chatbot.js?v=3",
    "https://dlsremodelaciones.cl/otro.js",
  ]);
});

test("incluye la librería de EmailJS cuando se pide su host", () => {
  const html = `<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>`;
  assert.deepEqual(scriptsLocales(html, SITIO, ["cdn.jsdelivr.net"]), [
    "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js",
  ]);
});

test("una portada sin scripts no revienta", () => {
  assert.deepEqual(scriptsLocales("<html><body>hola</body></html>", SITIO), []);
});
