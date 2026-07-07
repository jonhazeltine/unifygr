// Builds the password-gated land-sale page.
//
//   node scripts/land-page/build.mjs
//
// Reads scripts/land-page/source.html (the readable page), encrypts it with
// AES-GCM (key derived from the password via PBKDF2), and writes the gate to
// public/land-sale-update-b7f2/index.html. The content only exists as
// ciphertext in the served file — it decrypts in the browser when the correct
// password is entered. To change the page, edit source.html and re-run this.
//
// Password can be overridden with LAND_PAGE_PW; defaults to the value below.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PASSWORD = process.env.LAND_PAGE_PW || "happychurch";
const ITER = 150000;

const here = dirname(fileURLToPath(import.meta.url));
const source = await readFile(join(here, "source.html"), "utf8");

const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const keyMaterial = await crypto.subtle.importKey(
  "raw", enc.encode(PASSWORD), "PBKDF2", false, ["deriveKey"]
);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
  keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]
);
const ctBuf = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv }, key, enc.encode(source)
);

const b64 = (u8) => Buffer.from(u8).toString("base64");
const DATA = {
  salt: b64(salt),
  iv: b64(iv),
  ct: b64(new Uint8Array(ctBuf)),
  iter: ITER,
};

const gate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>New Life · Private Update</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  body{
    margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#F6F5F2;color:#262626;
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    -webkit-font-smoothing:antialiased;padding:24px;
  }
  .gate{
    width:100%;max-width:400px;background:#FFFFFF;border:1px solid #E5E2DD;
    border-radius:18px;padding:38px 32px 32px;text-align:center;
    box-shadow:0 1px 2px rgba(38,38,38,.04);
  }
  .gate img{height:64px;width:auto;margin-bottom:22px;}
  h1{
    font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:22px;
    margin:0 0 8px;letter-spacing:-.01em;
  }
  p.sub{font-size:14.5px;color:#6E6E6E;margin:0 0 24px;line-height:1.55;}
  form{display:flex;flex-direction:column;gap:12px;}
  input{
    font-family:inherit;font-size:16px;padding:13px 15px;border-radius:11px;
    border:1px solid #D9D5CE;background:#FBFAF8;color:#262626;text-align:center;
    letter-spacing:.02em;
  }
  input:focus{outline:none;border-color:#2F6E7A;box-shadow:0 0 0 3px rgba(47,110,122,.15);}
  button{
    font-family:inherit;font-size:15px;font-weight:600;padding:13px 15px;
    border:none;border-radius:11px;background:#2F6E7A;color:#fff;cursor:pointer;
    transition:background .15s;
  }
  button:hover{background:#28606B;}
  button:disabled{opacity:.6;cursor:default;}
  .err{
    font-size:13.5px;color:#B23A3A;margin:4px 0 0;min-height:18px;
    opacity:0;transition:opacity .15s;
  }
  .err.show{opacity:1;}
  .foot{font-size:12px;color:#9A948B;margin-top:22px;letter-spacing:.02em;}
</style>
</head>
<body>
  <div class="gate">
    <img src="new-life-logo.png" alt="New Life Grand Rapids">
    <h1>This update is private</h1>
    <p class="sub">Please enter the password to view where things stand with the land.</p>
    <form id="f">
      <input id="pw" type="password" autocomplete="current-password" placeholder="Password" autofocus>
      <button id="go" type="submit">View the update</button>
      <p class="err" id="err">That password didn't work — try again.</p>
    </form>
    <div class="foot">New Life · Grand Rapids</div>
  </div>
<script>
  var D = ${JSON.stringify(DATA)};
  function bytes(b64){var s=atob(b64),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
  async function decrypt(pw){
    var enc=new TextEncoder();
    var km=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveKey']);
    var key=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt:bytes(D.salt),iterations:D.iter,hash:'SHA-256'},
      km,{name:'AES-GCM',length:256},false,['decrypt']);
    var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(D.iv)},key,bytes(D.ct));
    return new TextDecoder().decode(pt);
  }
  function reveal(html){document.open();document.write(html);document.close();}
  var f=document.getElementById('f'),pw=document.getElementById('pw'),
      err=document.getElementById('err'),go=document.getElementById('go');
  async function attempt(p,silent){
    go.disabled=true;
    try{
      var html=await decrypt(p);
      try{sessionStorage.setItem('nl_land_pw',p);}catch(e){}
      reveal(html);
    }catch(e){
      go.disabled=false;
      if(!silent){err.classList.add('show');pw.value='';pw.focus();}
    }
  }
  f.addEventListener('submit',function(e){e.preventDefault();err.classList.remove('show');attempt(pw.value,false);});
  try{var saved=sessionStorage.getItem('nl_land_pw');if(saved)attempt(saved,true);}catch(e){}
</script>
</body>
</html>`;

const outDir = join(here, "..", "..", "public", "land-sale-update-b7f2");
await writeFile(join(outDir, "index.html"), gate, "utf8");

// self-test: round-trip decrypt with the real password (and confirm a wrong one fails)
async function tryDecrypt(pw) {
  const km = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  const k = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["decrypt"]
  );
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k, ctBuf);
  return new TextDecoder().decode(pt);
}
const ok = (await tryDecrypt(PASSWORD)) === source;
let wrongFails = false;
try { await tryDecrypt("wrong-password"); } catch { wrongFails = true; }
console.log(`gate written (${gate.length} bytes)`);
console.log(`round-trip decrypt with correct password: ${ok ? "OK" : "FAILED"}`);
console.log(`wrong password rejected: ${wrongFails ? "OK" : "FAILED"}`);
if (!ok || !wrongFails) process.exit(1);
