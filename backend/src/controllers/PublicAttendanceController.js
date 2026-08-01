const placementService = require('../services/PlacementService');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { BadRequestError } = require('../utils/AppError');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Override Helmet's default CSP so inline styles and scripts work in the served page.
function setPageCsp(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
  );
}

function renderAttendancePage(sessionTitle) {
  const safe = escapeHtml(sessionTitle);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>Mark Attendance &mdash; ${safe}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#f0f4ff;min-height:100vh;display:flex;
         align-items:center;justify-content:center;padding:16px}
    .card{background:#fff;border-radius:20px;padding:32px 24px 40px;
          max-width:400px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.10)}
    .hdr{text-align:center;margin-bottom:28px}
    .ico{font-size:48px;margin-bottom:12px}
    .title{font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:4px;line-height:1.3}
    .sub{font-size:14px;color:#888}
    .fg{margin-bottom:16px}
    label{display:block;font-size:13px;font-weight:600;color:#555;margin-bottom:6px}
    input{width:100%;padding:14px 16px;border:1.5px solid #e0e0e0;border-radius:12px;
          font-size:16px;color:#1a1a2e;outline:none;transition:border-color .2s;
          -webkit-appearance:none}
    input:focus{border-color:#4c8ef7;box-shadow:0 0 0 3px rgba(76,142,247,.12)}
    .btn{width:100%;padding:16px;background:#4c8ef7;color:#fff;border:none;
         border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;
         transition:background .2s,transform .1s;margin-top:8px;
         -webkit-tap-highlight-color:transparent}
    .btn:hover:not(:disabled){background:#3a7de8}
    .btn:active:not(:disabled){transform:scale(.98)}
    .btn:disabled{background:#a0c0f8;cursor:not-allowed}
    .msg{display:none;margin-top:20px;padding:14px 16px;border-radius:12px;
         font-size:14px;line-height:1.5}
    .msg.ok{background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9}
    .msg.err{background:#fff3e0;color:#e65100;border:1px solid #ffe0b2}
    .si{font-size:36px;text-align:center;margin-bottom:8px}
  </style>
</head>
<body>
<div class="card">
  <div class="hdr">
    <div class="ico">🏢</div>
    <div class="title">${safe}</div>
    <div class="sub">Mark your attendance for this placement drive</div>
  </div>
  <form id="f">
    <div class="fg">
      <label for="rn">Roll Number</label>
      <input type="text" id="rn" placeholder="e.g. 21CS001"
             autocomplete="off" autocorrect="off" spellcheck="false">
    </div>
    <div class="fg">
      <label for="ph">Phone Number</label>
      <input type="tel" id="ph" placeholder="10-digit mobile number"
             inputmode="numeric" maxlength="10">
    </div>
    <button type="submit" class="btn" id="btn">Mark My Attendance</button>
  </form>
  <div class="msg" id="msg"></div>
</div>
<script>
(function(){
  var form=document.getElementById('f'),
      btn=document.getElementById('btn'),
      msg=document.getElementById('msg');

  document.getElementById('rn').addEventListener('input',function(){
    this.value=this.value.toUpperCase().replace(/\\s/g,'');
  });
  document.getElementById('ph').addEventListener('input',function(){
    this.value=this.value.replace(/\\D/g,'').slice(0,10);
  });

  function show(html,type){
    msg.innerHTML=html;
    msg.className='msg '+type;
    msg.style.display='block';
    msg.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  form.addEventListener('submit',async function(e){
    e.preventDefault();
    var rn=document.getElementById('rn').value.trim();
    var ph=document.getElementById('ph').value.trim();
    if(!rn){show('Please enter your roll number.','err');return;}
    if(!/^\\d{10}$/.test(ph)){show('Please enter a valid 10-digit phone number.','err');return;}
    btn.disabled=true;
    btn.textContent='Submitting…';
    msg.style.display='none';
    try{
      var res=await fetch(window.location.href,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({rollNumber:rn,phoneNumber:ph})
      });
      var d=await res.json();
      if(d.success){
        form.style.display='none';
        show('<div class="si">&#x2705;</div><strong>Attendance recorded!</strong><br>Thank you, '+(d.data&&d.data.name?d.data.name:rn)+'.','ok');
      }else{
        show(d.message||'Failed to mark attendance. Please try again.','err');
        btn.disabled=false;btn.textContent='Mark My Attendance';
      }
    }catch(_){
      show('Network error. Please check your connection and try again.','err');
      btn.disabled=false;btn.textContent='Mark My Attendance';
    }
  });
})();
</script>
</body>
</html>`;
}

function renderClosedPage(sessionTitle) {
  const safe = escapeHtml(sessionTitle);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Closed</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:#f0f4ff;min-height:100vh;display:flex;
         align-items:center;justify-content:center;padding:16px}
    .card{background:#fff;border-radius:20px;padding:40px 24px;
          max-width:400px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.10);
          text-align:center}
    .ico{font-size:48px;margin-bottom:16px}
    h1{font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:8px}
    p{font-size:14px;color:#888;line-height:1.6}
  </style>
</head>
<body>
<div class="card">
  <div class="ico">&#x1F512;</div>
  <h1>${safe}</h1>
  <p>This placement session is no longer accepting attendance submissions.</p>
</div>
</body>
</html>`;
}

function renderErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,sans-serif;background:#f0f4ff;min-height:100vh;
         display:flex;align-items:center;justify-content:center;padding:16px}
    .card{background:#fff;border-radius:20px;padding:40px 24px;
          max-width:400px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.10);text-align:center}
    .ico{font-size:48px;margin-bottom:16px}
    p{font-size:15px;color:#555;line-height:1.6}
  </style>
</head>
<body>
<div class="card">
  <div class="ico">&#x26A0;&#xFE0F;</div>
  <p>${escapeHtml(message)}</p>
</div>
</body>
</html>`;
}

class PublicAttendanceController {
  async showAttendancePage(req, res) {
    const { sessionId } = req.params;
    setPageCsp(res);
    try {
      const session = await placementService.getSessionById(sessionId);
      if (!session) {
        return res.status(404).type('html').send(renderErrorPage('Session not found.'));
      }
      if (session.status !== 'ACTIVE') {
        return res.status(200).type('html').send(renderClosedPage(session.title));
      }
      return res.status(200).type('html').send(renderAttendancePage(session.title));
    } catch (_) {
      return res.status(500).type('html').send(renderErrorPage('Something went wrong. Please try again.'));
    }
  }

  async submitAttendance(req, res) {
    const { sessionId } = req.params;
    const { rollNumber, phoneNumber } = req.body;

    if (!rollNumber?.trim()) throw new BadRequestError('Roll number is required.');
    if (!/^\d{10}$/.test(phoneNumber?.trim() ?? '')) {
      throw new BadRequestError('Please enter a valid 10-digit phone number.');
    }

    const result = await placementService.submitVirtualAttendance(
      sessionId,
      rollNumber.trim().toUpperCase(),
      phoneNumber.trim(),
    );

    return sendSuccess(res, {
      message: `Attendance marked successfully for ${result.name}.`,
      data: { name: result.name, rollNumber: result.rollNumber },
    });
  }
}

module.exports = new PublicAttendanceController();
