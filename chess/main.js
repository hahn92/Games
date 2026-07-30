// Ajedrez — vs IA (minimax + alpha-beta) o 2 jugadores
(function () {

/* ── Canvas ── */
var canvas = document.getElementById('chessCanvas');
var ctx    = canvas.getContext('2d');
var W = canvas.width;   // 360
var H = canvas.height;  // 432

var BY = 32;   // board top y
var SQ = 45;   // square size (360/8)
var BX = 0;

/* ── Piece values & PST ── */
var PVAL = { P:100, N:320, B:330, R:500, Q:900, K:20000 };

var PST = {
    P: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
        [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
        [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
    N: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
        [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
        [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
        [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
    B: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
        [-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
        [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
        [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
    R: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
        [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
    Q: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
        [-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],
        [-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
    K: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
        [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]]
};

/* ── Game state ── */
var gs = {
    board: null, turn: 'w', sel: null, moves: [],
    ep: null, castle: null,
    status: 'idle',
    mode: 'ai',
    aiColor: 'b', lastMove: null, aiThinking: false
};

/* ── Persistent stats (vs IA) & mobile overlay ── */
var mobileScoreEl = document.getElementById('mobileScore');
var stats = (function () {
    try { return JSON.parse(localStorage.getItem('chessStats') || '{"w":0,"l":0,"d":0}'); }
    catch (e) { return { w: 0, l: 0, d: 0 }; }
}());
function saveStats() { try { localStorage.setItem('chessStats', JSON.stringify(stats)); } catch (e) {} }
function updateMobileScore() {
    if (!mobileScoreEl) return;
    var st = gs.status==='checkmate' ? (gs.turn==='w'?'Ganan Negras':'Ganan Blancas')
           : gs.status==='stalemate' ? 'Tablas'
           : gs.status==='check'     ? (gs.turn==='w'?'Jaque a Blancas':'Jaque a Negras')
           : gs.status==='idle'      ? 'Pulsa Nueva Partida'
           : (gs.turn==='w'?'Turno: Blancas':'Turno: Negras');
    mobileScoreEl.textContent = st + ' · G:' + stats.w + ' P:' + stats.l + ' E:' + stats.d;
}

/* ── Board init ── */
function makeBoard() {
    var b = [], back = ['R','N','B','Q','K','B','N','R'];
    for (var r = 0; r < 8; r++) {
        b[r] = [];
        for (var c = 0; c < 8; c++) {
            if      (r === 0) b[r][c] = { t: back[c], c: 'b' };
            else if (r === 1) b[r][c] = { t: 'P',     c: 'b' };
            else if (r === 6) b[r][c] = { t: 'P',     c: 'w' };
            else if (r === 7) b[r][c] = { t: back[c], c: 'w' };
            else              b[r][c] = null;
        }
    }
    return b;
}
function freshCastle() { return { wK:true, wQR:true, wKR:true, bK:true, bQR:true, bKR:true }; }

function newGame() {
    gs.board = makeBoard(); gs.castle = freshCastle();
    gs.turn = 'w'; gs.sel = null; gs.moves = [];
    gs.ep = null; gs.lastMove = null; gs.aiThinking = false;
    gs.status = 'playing';
    updateModeLabel();
    updateMobileScore();
    GameAudio.start();
    if (gs.mode === 'ai' && gs.aiColor === 'w') { gs.aiThinking = true; setTimeout(doAiMove, 300); }
}

/* ── Helpers ── */
function inB(r,c) { return r>=0&&r<8&&c>=0&&c<8; }
function copyBoard(b) { return b.map(function(row){ return row.map(function(p){ return p?{t:p.t,c:p.c}:null; }); }); }
function copyC(ca) { return Object.assign({},ca); }

/* ── Attack detection ── */
function pathClear(b,fr,fc,tr,tc) {
    var dr=tr-fr,dc=tc-fc,s=Math.max(Math.abs(dr),Math.abs(dc));
    var sr=dr?dr/Math.abs(dr):0,sc=dc?dc/Math.abs(dc):0;
    for (var i=1;i<s;i++) if (b[fr+i*sr][fc+i*sc]) return false;
    return true;
}
function attacks(b,fr,fc,tr,tc,type,color) {
    var dr=tr-fr,dc=tc-fc,ad=Math.abs(dr),ac=Math.abs(dc);
    switch(type) {
        case 'P': return dr===(color==='w'?-1:1)&&ac===1;
        case 'N': return (ad===2&&ac===1)||(ad===1&&ac===2);
        case 'K': return ad<=1&&ac<=1&&(dr||dc);
        case 'B': return ad===ac&&ad>0&&pathClear(b,fr,fc,tr,tc);
        case 'R': return (dr===0||dc===0)&&(dr||dc)&&pathClear(b,fr,fc,tr,tc);
        case 'Q': return attacks(b,fr,fc,tr,tc,'B',color)||attacks(b,fr,fc,tr,tc,'R',color);
    }
    return false;
}
function isAttacked(b,r,c,byColor) {
    for (var ar=0;ar<8;ar++) for (var ac=0;ac<8;ac++) {
        var p=b[ar][ac];
        if (p&&p.c===byColor&&attacks(b,ar,ac,r,c,p.t,byColor)) return true;
    }
    return false;
}
function findKing(b,color) {
    for (var r=0;r<8;r++) for (var c=0;c<8;c++) {
        var p=b[r][c]; if (p&&p.t==='K'&&p.c===color) return {r:r,c:c};
    }
    return null;
}
function isInCheck(b,color) { var k=findKing(b,color); return k&&isAttacked(b,k.r,k.c,color==='w'?'b':'w'); }

/* ── Move generation ── */
function pseudoMoves(b,r,c,ep,castle) {
    var p=b[r][c]; if (!p) return [];
    var col=p.c,opp=col==='w'?'b':'w',moves=[];
    function add(tr,tc,f) {
        if (!inB(tr,tc)) return;
        var tgt=b[tr][tc];
        if (!tgt||tgt.c===opp) moves.push({fr:r,fc:c,tr:tr,tc:tc,f:f||''});
    }
    function slide(dr,dc) {
        var nr=r+dr,nc=c+dc;
        while (inB(nr,nc)) { var t=b[nr][nc]; if (t){if(t.c===opp)add(nr,nc,'cap');break;} add(nr,nc); nr+=dr;nc+=dc; }
    }
    switch (p.t) {
        case 'P': {
            var dir=col==='w'?-1:1,start=col==='w'?6:1,proR=col==='w'?0:7;
            if (inB(r+dir,c)&&!b[r+dir][c]) {
                add(r+dir,c,r+dir===proR?'pro':'');
                if (r===start&&!b[r+2*dir][c]) add(r+2*dir,c,'ep2');
            }
            [-1,1].forEach(function(dc2){
                var nr=r+dir,nc=c+dc2; if(!inB(nr,nc))return;
                if(b[nr][nc]&&b[nr][nc].c===opp) moves.push({fr:r,fc:c,tr:nr,tc:nc,f:nr===proR?'pro':'cap'});
                if(ep&&ep.r===nr&&ep.c===nc) moves.push({fr:r,fc:c,tr:nr,tc:nc,f:'ep'});
            });
            break;
        }
        case 'N': [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(function(d){add(r+d[0],c+d[1]);}); break;
        case 'B': [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(d){slide(d[0],d[1]);}); break;
        case 'R': [[-1,0],[1,0],[0,-1],[0,1]].forEach(function(d){slide(d[0],d[1]);}); break;
        case 'Q': [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(function(d){slide(d[0],d[1]);}); break;
        case 'K': {
            [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(function(d){add(r+d[0],c+d[1]);});
            var cr=col==='w'?7:0,kk=col==='w'?'wK':'bK',kqr=col==='w'?'wQR':'bQR',kkr=col==='w'?'wKR':'bKR';
            if (castle[kk]&&r===cr&&c===4) {
                if (castle[kkr]&&!b[cr][5]&&!b[cr][6]) moves.push({fr:r,fc:c,tr:cr,tc:6,f:'cK'});
                if (castle[kqr]&&!b[cr][3]&&!b[cr][2]&&!b[cr][1]) moves.push({fr:r,fc:c,tr:cr,tc:2,f:'cQ'});
            }
            break;
        }
    }
    return moves;
}

/* ── Apply move ── */
function applyMove(b,mv,ep,castle) {
    var nb=copyBoard(b),nc=copyC(castle),np=nb[mv.fr][mv.fc],newEp=null;
    nb[mv.tr][mv.tc]=np; nb[mv.fr][mv.fc]=null;
    if (mv.f==='ep')  nb[mv.fr][mv.tc]=null;
    if (mv.f==='ep2') newEp={r:(mv.fr+mv.tr)/2,c:mv.tc};
    if (mv.f==='pro') nb[mv.tr][mv.tc]={t:'Q',c:np.c};
    if (mv.f==='cK')  { nb[mv.tr][5]=nb[mv.tr][7]; nb[mv.tr][7]=null; }
    if (mv.f==='cQ')  { nb[mv.tr][3]=nb[mv.tr][0]; nb[mv.tr][0]=null; }
    if (np.t==='K') { if(np.c==='w'){nc.wK=nc.wKR=nc.wQR=false;}else{nc.bK=nc.bKR=nc.bQR=false;} }
    if (np.t==='R') {
        if(mv.fr===7&&mv.fc===7)nc.wKR=false; if(mv.fr===7&&mv.fc===0)nc.wQR=false;
        if(mv.fr===0&&mv.fc===7)nc.bKR=false; if(mv.fr===0&&mv.fc===0)nc.bQR=false;
    }
    /* El derecho de enroque también se pierde si la torre es CAPTURADA en su
     * casilla inicial: ahí no se mueve ninguna torre, así que el bloque de
     * arriba (que sólo mira la casilla de ORIGEN) no lo detectaba. Sin esto,
     * tras Nxh1 las blancas seguían pudiendo "enrocar" corto sin torre,
     * dejando el rey en g1 y una torre fantasma en f1. */
    if(mv.tr===7&&mv.tc===7)nc.wKR=false; if(mv.tr===7&&mv.tc===0)nc.wQR=false;
    if(mv.tr===0&&mv.tc===7)nc.bKR=false; if(mv.tr===0&&mv.tc===0)nc.bQR=false;
    return {board:nb,ep:newEp,castle:nc};
}

/* ── Legal moves ── */
function getLegal(b,r,c,ep,castle) {
    var p=b[r][c]; if(!p) return [];
    var col=p.c,pseudo=pseudoMoves(b,r,c,ep,castle),legal=[];
    for (var i=0;i<pseudo.length;i++) {
        var mv=pseudo[i],ns=applyMove(b,mv,ep,castle);
        if (isInCheck(ns.board,col)) continue;
        if (mv.f==='cK'||mv.f==='cQ') {
            if (isInCheck(b,col)) continue;
            var passC=mv.f==='cK'?5:3;
            var tb=copyBoard(b); tb[mv.fr][passC]=tb[mv.fr][mv.fc]; tb[mv.fr][mv.fc]=null;
            if (isInCheck(tb,col)) continue;
        }
        legal.push(mv);
    }
    return legal;
}
function getAllLegal(b,color,ep,castle) {
    var all=[];
    for (var r=0;r<8;r++) for (var c=0;c<8;c++)
        if (b[r][c]&&b[r][c].c===color) all=all.concat(getLegal(b,r,c,ep,castle));
    return all;
}

/* ── Execute move ── */
function executeMove(mv) {
    var captured=!!(gs.board[mv.tr][mv.tc])||mv.f==='ep';
    var ns=applyMove(gs.board,mv,gs.ep,gs.castle);
    gs.board=ns.board; gs.ep=ns.ep; gs.castle=ns.castle;
    gs.lastMove=mv; gs.turn=gs.turn==='w'?'b':'w';
    gs.sel=null; gs.moves=[];
    var opp=gs.turn,oppAll=getAllLegal(gs.board,opp,gs.ep,gs.castle);
    if (!oppAll.length) gs.status=isInCheck(gs.board,opp)?'checkmate':'stalemate';
    else gs.status=isInCheck(gs.board,opp)?'check':'playing';
    // Record vs-IA results in persistent stats
    if (gs.mode==='ai') {
        if (gs.status==='checkmate') {
            if (gs.turn===gs.aiColor) stats.w++; else stats.l++;
            saveStats();
        } else if (gs.status==='stalemate') {
            stats.d++; saveStats();
        }
    }
    updateMobileScore();
    return captured;
}

/* ── AI ── */
function evaluate(b) {
    var score=0;
    for (var r=0;r<8;r++) for (var c=0;c<8;c++) {
        var p=b[r][c]; if(!p) continue;
        var pr=p.c==='w'?r:7-r,pst=PST[p.t]?PST[p.t][pr][c]:0;
        score+=p.c==='w'?PVAL[p.t]+pst:-(PVAL[p.t]+pst);
    }
    return score;
}
function minimax(b,depth,alpha,beta,isMax,ep,castle) {
    var color=isMax?'w':'b';
    var legal=getAllLegal(b,color,ep,castle);
    if (!legal.length) return isInCheck(b,color)?(isMax?-9999+depth:9999-depth):0;
    if (depth===0) return evaluate(b);
    if (isMax) {
        var best=-Infinity;
        for (var i=0;i<legal.length;i++) {
            var ns=applyMove(b,legal[i],ep,castle);
            var v=minimax(ns.board,depth-1,alpha,beta,false,ns.ep,ns.castle);
            if(v>best)best=v; if(best>alpha)alpha=best; if(beta<=alpha)break;
        }
        return best;
    } else {
        var best=Infinity;
        for (var i=0;i<legal.length;i++) {
            var ns=applyMove(b,legal[i],ep,castle);
            var v=minimax(ns.board,depth-1,alpha,beta,true,ns.ep,ns.castle);
            if(v<best)best=v; if(best<beta)beta=best; if(beta<=alpha)break;
        }
        return best;
    }
}
function getBestMove() {
    var col=gs.aiColor,isMax=col==='w';
    var legal=getAllLegal(gs.board,col,gs.ep,gs.castle);
    if (!legal.length) return null;
    for (var i=legal.length-1;i>0;i--){var j=(Math.random()*(i+1))|0;var t=legal[i];legal[i]=legal[j];legal[j]=t;}
    var best=isMax?-Infinity:Infinity,bestMv=null;
    for (var i=0;i<legal.length;i++) {
        var ns=applyMove(gs.board,legal[i],gs.ep,gs.castle);
        var v=minimax(ns.board,2,-Infinity,Infinity,!isMax,ns.ep,ns.castle);
        if((isMax&&v>best)||(!isMax&&v<best)){best=v;bestMv=legal[i];}
    }
    return bestMv;
}
function doAiMove() {
    if (gs.status!=='playing'&&gs.status!=='check'){gs.aiThinking=false;return;}
    var mv=getBestMove();
    if (mv) {
        var captured=executeMove(mv);
        if      (gs.status==='checkmate') GameAudio.gameOver();
        else if (gs.status==='check')     GameAudio.hit();
        else if (captured)                GameAudio.brick();
        else                              GameAudio.place();
    }
    gs.aiThinking=false;
}

/* ════════════════════════════════════════════════════
   RENDERING — dark gaming theme + 3D pieces
   ════════════════════════════════════════════════════ */

/* ── Piece color palettes ── */
var WC = { hi:'#f0f6ff', mid:'#8aaee0', lo:'#182050', spec:'rgba(255,255,255,0.84)', glow:'#8fd3f4' };
var BC = { hi:'#40163a', mid:'#1c0828', lo:'#070210', spec:'rgba(190,110,255,0.44)', glow:'#ff512f' };

function gPc(isW) { return isW ? WC : BC; }

/* ── Gradient helpers ── */
// Cylindrical shading: bright on left-center, dark on both edges — simulates a round piece
function gCyl(cx, w, isW) {
    var g=ctx.createLinearGradient(cx-w/2,0,cx+w/2,0), C=gPc(isW);
    g.addColorStop(0,C.lo); g.addColorStop(0.12,C.mid);
    g.addColorStop(0.28,C.hi); g.addColorStop(0.60,C.mid); g.addColorStop(1,C.lo);
    return g;
}
function gV(cx, y, h, isW) {
    var g=ctx.createLinearGradient(cx,y,cx,y+h), C=gPc(isW);
    g.addColorStop(0,C.hi); g.addColorStop(0.45,C.mid); g.addColorStop(1,C.lo);
    return g;
}
function gR(cx, cy, r, isW) {
    var g=ctx.createRadialGradient(cx-r*0.28,cy-r*0.30,r*0.04,cx,cy,r), C=gPc(isW);
    g.addColorStop(0,C.hi); g.addColorStop(0.50,C.mid); g.addColorStop(1,C.lo);
    return g;
}

/* ── Shadow ellipse ── */
function pShadow(cx, by) {
    ctx.fillStyle='rgba(0,0,0,0.52)';
    ctx.beginPath(); ctx.ellipse(cx+2,by+3,SQ*0.33,SQ*0.082,0,0,Math.PI*2); ctx.fill();
}

/* ── Elliptical base disk ── */
function pDisk(cx, by, rx, isW) {
    var C=gPc(isW), ry=rx*0.30;
    var g=ctx.createLinearGradient(cx,by-ry,cx,by+ry);
    g.addColorStop(0,C.mid); g.addColorStop(1,C.lo);
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(cx,by,rx,ry,0,0,Math.PI*2); ctx.fill();
    // top rim highlight
    ctx.strokeStyle=isW?'rgba(255,255,255,0.50)':C.glow+'66';
    ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.ellipse(cx,by-ry*0.18,rx*0.80,ry*0.52,0,Math.PI,0); ctx.stroke();
}

/* ── LEFT HIGHLIGHT strip (simulates cylindrical lit left face) ── */
function pHL(cx, y, h, w, isW) {
    ctx.fillStyle=isW?'rgba(255,255,255,0.16)':'rgba(180,100,255,0.13)';
    ctx.fillRect(cx-w/2, y, w*0.26, h);
}

/* ── DEPRECATED ─ kept for gR usage in pBall ── */
function pTaper(cx, y, rBot, rTop, h, isW) {
    var C=gPc(isW);
    ctx.fillStyle=gV(cx,y-h,h,isW);
    ctx.beginPath();
    ctx.moveTo(cx-rBot,y);
    ctx.bezierCurveTo(cx-rBot*0.92,y-h*0.35, cx-rTop*1.18,y-h*0.65, cx-rTop,y-h);
    ctx.lineTo(cx+rTop,y-h);
    ctx.bezierCurveTo(cx+rTop*1.18,y-h*0.65, cx+rBot*0.92,y-h*0.35, cx+rBot,y);
    ctx.closePath(); ctx.fill();
    // left highlight strip
    ctx.fillStyle=isW?'rgba(255,255,255,0.20)':'rgba(140,75,210,0.13)';
    ctx.beginPath();
    ctx.moveTo(cx-rBot,y);
    ctx.bezierCurveTo(cx-rBot*0.92,y-h*0.35, cx-rTop*1.18,y-h*0.65, cx-rTop,y-h);
    ctx.lineTo(cx-rTop*0.28,y-h);
    ctx.bezierCurveTo(cx-rTop*0.52,y-h*0.65, cx-rBot*0.55,y-h*0.35, cx-rBot*0.55,y);
    ctx.closePath(); ctx.fill();
    // right shadow strip
    ctx.fillStyle='rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.moveTo(cx+rBot,y);
    ctx.bezierCurveTo(cx+rBot*0.92,y-h*0.35, cx+rTop*1.18,y-h*0.65, cx+rTop,y-h);
    ctx.lineTo(cx+rTop*0.55,y-h);
    ctx.bezierCurveTo(cx+rTop*0.70,y-h*0.65, cx+rBot*0.72,y-h*0.35, cx+rBot*0.72,y);
    ctx.closePath(); ctx.fill();
    // glow edge
    ctx.strokeStyle=C.glow+'33'; ctx.lineWidth=0.8;
    ctx.beginPath();
    ctx.moveTo(cx-rBot,y);
    ctx.bezierCurveTo(cx-rBot*0.92,y-h*0.35, cx-rTop*1.18,y-h*0.65, cx-rTop,y-h);
    ctx.lineTo(cx+rTop,y-h);
    ctx.bezierCurveTo(cx+rTop*1.18,y-h*0.65, cx+rBot*0.92,y-h*0.35, cx+rBot,y);
    ctx.stroke();
}

/* ── Collar ring between stem and head ── */
function pCollar(cx, y, r, isW) {
    var C=gPc(isW);
    var g=ctx.createLinearGradient(cx,y-r*0.38,cx,y+r*0.38);
    g.addColorStop(0,C.hi); g.addColorStop(0.5,C.mid); g.addColorStop(1,C.lo);
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.ellipse(cx,y,r,r*0.32,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.glow+'88'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(cx,y-r*0.06,r*0.88,r*0.18,0,Math.PI,0); ctx.stroke();
}

/* ── Sphere with specular ── */
function pBall(cx, cy, r, isW) {
    var C=gPc(isW);
    ctx.fillStyle=gR(cx,cy,r,isW);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
    // specular highlight
    ctx.fillStyle=C.spec;
    ctx.beginPath(); ctx.ellipse(cx-r*0.28,cy-r*0.30,r*0.23,r*0.16,-0.38,0,Math.PI*2); ctx.fill();
    // secondary soft glow
    ctx.fillStyle=isW?'rgba(255,255,255,0.10)':'rgba(180,100,255,0.08)';
    ctx.beginPath(); ctx.ellipse(cx+r*0.14,cy+r*0.18,r*0.18,r*0.12,0.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.glow+'77'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
}

/* ══════════════════════════════════════════════
   PIECE FUNCTIONS — Staunton silhouettes
   Cylindrical gradient fills (gCyl) give 3-D depth.
   Each piece has a unique polygon profile.
   ══════════════════════════════════════════════ */

/* ── PAWN ── round ball on narrow waist, smallest piece ── */
function pPawn(cx, cy, isW) {
    var s=SQ, by=cy+s*0.27, C=gPc(isW);
    pShadow(cx,by);
    pDisk(cx,by,s*0.325,isW);
    // Stem: wide base → narrow waist
    var hw=s*0.255, ww=s*0.085;
    ctx.fillStyle=gCyl(cx,hw*2,isW);
    ctx.beginPath();
    ctx.moveTo(cx-hw,       by-s*0.038);
    ctx.lineTo(cx+hw,       by-s*0.038);
    ctx.bezierCurveTo(cx+hw*0.82,by-s*0.082, cx+ww*1.55,by-s*0.135, cx+ww,by-s*0.196);
    ctx.lineTo(cx+ww,       by-s*0.252);
    ctx.lineTo(cx-ww,       by-s*0.252);
    ctx.lineTo(cx-ww,       by-s*0.196);
    ctx.bezierCurveTo(cx-ww*1.55,by-s*0.135, cx-hw*0.82,by-s*0.082, cx-hw,by-s*0.038);
    ctx.closePath(); ctx.fill();
    pHL(cx, by-s*0.252, s*0.214, hw*2, isW);
    pBall(cx, by-s*0.408, s*0.165, isW);
}

/* ── ROOK ── flat-topped tower with 3 crenellations ── */
function pRook(cx, cy, isW) {
    var s=SQ, by=cy+s*0.27, C=gPc(isW);
    pShadow(cx,by);
    pDisk(cx,by,s*0.338,isW);
    var hw=s*0.218;
    // Body (straight sides, slightly wider at base)
    ctx.fillStyle=gCyl(cx,hw*2.2,isW);
    ctx.beginPath();
    ctx.moveTo(cx-hw*1.16,by-s*0.038); ctx.lineTo(cx+hw*1.16,by-s*0.038);
    ctx.lineTo(cx+hw,     by-s*0.082); ctx.lineTo(cx+hw,     by-s*0.305);
    ctx.lineTo(cx-hw,     by-s*0.305); ctx.lineTo(cx-hw,     by-s*0.082);
    ctx.closePath(); ctx.fill();
    pHL(cx, by-s*0.305, s*0.267, hw*2, isW);
    // Platform ledge (wider than body)
    var pl=s*0.262, platY=by-s*0.305;
    ctx.fillStyle=gCyl(cx,pl*2,isW);
    ctx.beginPath();
    ctx.moveTo(cx-pl,platY); ctx.lineTo(cx+pl,platY);
    ctx.lineTo(cx+pl,platY-s*0.044); ctx.lineTo(cx-pl,platY-s*0.044);
    ctx.closePath(); ctx.fill();
    pHL(cx, platY-s*0.044, s*0.044, pl*2, isW);
    // 3 merlons (crenellations)
    var bw=s*0.118, bh=s*0.108, pt=platY-s*0.044;
    ctx.fillStyle=gCyl(cx,pl*2,isW);
    ctx.beginPath();
    [-s*0.152, 0, s*0.152].forEach(function(dx) {
        ctx.moveTo(cx+dx-bw/2,pt);      ctx.lineTo(cx+dx-bw/2,pt-bh);
        ctx.lineTo(cx+dx+bw/2,pt-bh);  ctx.lineTo(cx+dx+bw/2,pt);
    });
    ctx.fill();
    // Merlon highlights
    ctx.fillStyle=isW?'rgba(255,255,255,0.22)':'rgba(180,100,255,0.15)';
    [-s*0.152, 0, s*0.152].forEach(function(dx) {
        ctx.fillRect(cx+dx-bw/2, pt-bh, bw*0.28, bh);
    });
    ctx.strokeStyle=C.glow+'44'; ctx.lineWidth=0.8;
    [-s*0.152, 0, s*0.152].forEach(function(dx) {
        ctx.strokeRect(cx+dx-bw/2, pt-bh, bw, bh);
    });
}

/* ── KNIGHT ── horse head profile facing right, with mane, eye, nostril ── */
function pKnight(cx, cy, isW) {
    var s=SQ, by=cy+s*0.27, C=gPc(isW);
    pShadow(cx,by);
    pDisk(cx,by,s*0.338,isW);
    var base=by-s*0.030;
    // Neck body
    ctx.fillStyle=gCyl(cx,s*0.360,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.155,base);
    ctx.bezierCurveTo(cx-s*0.130,base-s*0.090, cx-s*0.050,base-s*0.140, cx-s*0.050,base-s*0.200);
    ctx.lineTo(cx+s*0.160,base-s*0.200);
    ctx.bezierCurveTo(cx+s*0.155,base-s*0.138, cx+s*0.192,base-s*0.068, cx+s*0.175,base);
    ctx.closePath(); ctx.fill();
    pHL(cx, base-s*0.200, s*0.170, s*0.360, isW);
    // Horse head — full silhouette (facing right)
    var nT=base-s*0.200;
    var gh=ctx.createLinearGradient(cx-s*0.155,nT-s*0.250,cx+s*0.280,nT);
    gh.addColorStop(0,C.hi); gh.addColorStop(0.38,C.mid); gh.addColorStop(1,C.lo);
    ctx.fillStyle=gh;
    ctx.beginPath();
    // bottom of head (left to right)
    ctx.moveTo(cx-s*0.050,nT);
    ctx.lineTo(cx+s*0.145,nT);
    // jaw curves out rightward
    ctx.lineTo(cx+s*0.215,nT-s*0.055);
    ctx.bezierCurveTo(cx+s*0.272,nT-s*0.092, cx+s*0.275,nT-s*0.148, cx+s*0.255,nT-s*0.175);
    // snout (protrudes right)
    ctx.lineTo(cx+s*0.272,nT-s*0.210);
    ctx.bezierCurveTo(cx+s*0.252,nT-s*0.238, cx+s*0.230,nT-s*0.258, cx+s*0.212,nT-s*0.268);
    // nose bridge rises
    ctx.bezierCurveTo(cx+s*0.230,nT-s*0.298, cx+s*0.218,nT-s*0.338, cx+s*0.152,nT-s*0.370);
    // forehead
    ctx.bezierCurveTo(cx+s*0.105,nT-s*0.392, cx+s*0.058,nT-s*0.402, cx+s*0.040,nT-s*0.422);
    // poll / crown
    ctx.bezierCurveTo(cx+s*0.020,nT-s*0.440, cx-s*0.012,nT-s*0.442, cx-s*0.042,nT-s*0.430);
    // crest / back of head
    ctx.bezierCurveTo(cx-s*0.108,nT-s*0.408, cx-s*0.145,nT-s*0.348, cx-s*0.145,nT-s*0.268);
    // back of neck going down
    ctx.bezierCurveTo(cx-s*0.145,nT-s*0.192, cx-s*0.110,nT-s*0.128, cx-s*0.050,nT-s*0.068);
    ctx.closePath(); ctx.fill();
    // Mane strip (back of head/neck, darker)
    ctx.fillStyle=isW?'rgba(70,110,195,0.40)':'rgba(88,28,138,0.52)';
    ctx.beginPath();
    ctx.moveTo(cx-s*0.050,nT-s*0.068);
    ctx.bezierCurveTo(cx-s*0.110,nT-s*0.128, cx-s*0.145,nT-s*0.192, cx-s*0.145,nT-s*0.268);
    ctx.bezierCurveTo(cx-s*0.145,nT-s*0.348, cx-s*0.108,nT-s*0.408, cx-s*0.042,nT-s*0.430);
    ctx.lineTo(cx-s*0.008,nT-s*0.430);
    ctx.bezierCurveTo(cx-s*0.062,nT-s*0.406, cx-s*0.098,nT-s*0.346, cx-s*0.098,nT-s*0.268);
    ctx.bezierCurveTo(cx-s*0.098,nT-s*0.194, cx-s*0.072,nT-s*0.134, cx-s*0.025,nT-s*0.068);
    ctx.closePath(); ctx.fill();
    // Face highlight (right/front side of head)
    ctx.fillStyle=isW?'rgba(255,255,255,0.15)':'rgba(180,100,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(cx+s*0.145,nT);
    ctx.lineTo(cx+s*0.215,nT-s*0.055);
    ctx.bezierCurveTo(cx+s*0.248,nT-s*0.086, cx+s*0.248,nT-s*0.138, cx+s*0.232,nT-s*0.165);
    ctx.lineTo(cx+s*0.248,nT-s*0.200);
    ctx.bezierCurveTo(cx+s*0.232,nT-s*0.228, cx+s*0.215,nT-s*0.248, cx+s*0.198,nT-s*0.258);
    ctx.bezierCurveTo(cx+s*0.215,nT-s*0.290, cx+s*0.205,nT-s*0.328, cx+s*0.145,nT-s*0.360);
    ctx.lineTo(cx+s*0.095,nT-s*0.380);
    ctx.bezierCurveTo(cx+s*0.115,nT-s*0.362, cx+s*0.118,nT-s*0.335, cx+s*0.105,nT-s*0.308);
    ctx.lineTo(cx+s*0.100,nT-s*0.222);
    ctx.bezierCurveTo(cx+s*0.112,nT-s*0.178, cx+s*0.114,nT-s*0.130, cx+s*0.098,nT-s*0.080);
    ctx.closePath(); ctx.fill();
    // Eye: iris + pupil + catch-light
    ctx.fillStyle=isW?'#2a4888':'rgba(225,168,38,0.95)';
    ctx.beginPath(); ctx.arc(cx+s*0.102,nT-s*0.326,s*0.032,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.90)';
    ctx.beginPath(); ctx.arc(cx+s*0.108,nT-s*0.332,s*0.018,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.78)';
    ctx.beginPath(); ctx.arc(cx+s*0.098,nT-s*0.340,s*0.008,0,Math.PI*2); ctx.fill();
    // Nostril
    ctx.fillStyle=isW?'rgba(0,0,0,0.36)':'rgba(255,90,18,0.50)';
    ctx.beginPath(); ctx.ellipse(cx+s*0.250,nT-s*0.196,s*0.026,s*0.016,-0.28,0,Math.PI*2); ctx.fill();
    // Outline glow
    ctx.strokeStyle=C.glow+'55'; ctx.lineWidth=0.9;
    ctx.beginPath();
    ctx.moveTo(cx-s*0.050,nT); ctx.lineTo(cx+s*0.145,nT);
    ctx.lineTo(cx+s*0.215,nT-s*0.055);
    ctx.bezierCurveTo(cx+s*0.272,nT-s*0.092, cx+s*0.275,nT-s*0.148, cx+s*0.255,nT-s*0.175);
    ctx.lineTo(cx+s*0.272,nT-s*0.210);
    ctx.bezierCurveTo(cx+s*0.252,nT-s*0.238, cx+s*0.230,nT-s*0.258, cx+s*0.212,nT-s*0.268);
    ctx.bezierCurveTo(cx+s*0.230,nT-s*0.298, cx+s*0.218,nT-s*0.338, cx+s*0.152,nT-s*0.370);
    ctx.bezierCurveTo(cx+s*0.105,nT-s*0.392, cx+s*0.058,nT-s*0.402, cx+s*0.040,nT-s*0.422);
    ctx.bezierCurveTo(cx+s*0.020,nT-s*0.440, cx-s*0.012,nT-s*0.442, cx-s*0.042,nT-s*0.430);
    ctx.bezierCurveTo(cx-s*0.108,nT-s*0.408, cx-s*0.145,nT-s*0.348, cx-s*0.145,nT-s*0.268);
    ctx.bezierCurveTo(cx-s*0.145,nT-s*0.192, cx-s*0.110,nT-s*0.128, cx-s*0.050,nT-s*0.068);
    ctx.closePath(); ctx.stroke();
}

/* ── BISHOP ── tall mitre with two tapered sections ── */
function pBishop(cx, cy, isW) {
    var s=SQ, by=cy+s*0.27, C=gPc(isW);
    pShadow(cx,by);
    pDisk(cx,by,s*0.322,isW);
    var hw=s*0.192, ww=s*0.072;
    // Lower body — curved taper
    ctx.fillStyle=gCyl(cx,hw*2,isW);
    ctx.beginPath();
    ctx.moveTo(cx-hw*1.20,by-s*0.038); ctx.lineTo(cx+hw*1.20,by-s*0.038);
    ctx.lineTo(cx+hw,     by-s*0.080);
    ctx.bezierCurveTo(cx+hw*0.88,by-s*0.120, cx+ww*1.65,by-s*0.182, cx+ww,by-s*0.228);
    ctx.lineTo(cx-ww,     by-s*0.228);
    ctx.bezierCurveTo(cx-ww*1.65,by-s*0.182, cx-hw*0.88,by-s*0.120, cx-hw,by-s*0.080);
    ctx.closePath(); ctx.fill();
    pHL(cx, by-s*0.228, s*0.190, hw*2, isW);
    // Collar band
    ctx.fillStyle=gCyl(cx,s*0.288,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.138,by-s*0.228); ctx.lineTo(cx+s*0.138,by-s*0.228);
    ctx.lineTo(cx+s*0.138,by-s*0.272); ctx.lineTo(cx-s*0.138,by-s*0.272);
    ctx.closePath(); ctx.fill();
    // Upper body — narrower taper
    var colT=by-s*0.272;
    ctx.fillStyle=gCyl(cx,s*0.210,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.102,colT); ctx.lineTo(cx+s*0.102,colT);
    ctx.bezierCurveTo(cx+s*0.095,colT-s*0.058, cx+s*0.066,colT-s*0.105, cx+s*0.058,colT-s*0.148);
    ctx.lineTo(cx-s*0.058,colT-s*0.148);
    ctx.bezierCurveTo(cx-s*0.066,colT-s*0.105, cx-s*0.095,colT-s*0.058, cx-s*0.102,colT);
    ctx.closePath(); ctx.fill();
    // Mitre cap (oval)
    var capY=colT-s*0.148;
    ctx.fillStyle=gCyl(cx,s*0.168,isW);
    ctx.beginPath(); ctx.ellipse(cx,capY,s*0.084,s*0.065,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=C.glow+'55'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.ellipse(cx,capY,s*0.084,s*0.065,0,0,Math.PI*2); ctx.stroke();
    // Finial ball
    pBall(cx, capY-s*0.078, s*0.072, isW);
    // Bishop spike (pointed top)
    ctx.fillStyle=gCyl(cx,s*0.055,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.028,capY-s*0.078); ctx.lineTo(cx+s*0.028,capY-s*0.078);
    ctx.lineTo(cx,capY-s*0.205); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.glow+'99'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(cx,capY-s*0.078); ctx.lineTo(cx,capY-s*0.205); ctx.stroke();
    // Mitre slot mark (distinctive bishop detail)
    ctx.strokeStyle=C.glow+'88'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(cx-s*0.062,capY+s*0.002); ctx.lineTo(cx+s*0.062,capY+s*0.002); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,capY+s*0.055); ctx.lineTo(cx,capY-s*0.078); ctx.stroke();
}

/* ── QUEEN ── wide crown with 5 graduated balls ── */
function pQueen(cx, cy, isW) {
    var s=SQ, by=cy+s*0.27, C=gPc(isW);
    pShadow(cx,by);
    pDisk(cx,by,s*0.335,isW);
    var hw=s*0.205, ww=s*0.078;
    // Lower body
    ctx.fillStyle=gCyl(cx,hw*2,isW);
    ctx.beginPath();
    ctx.moveTo(cx-hw*1.18,by-s*0.038); ctx.lineTo(cx+hw*1.18,by-s*0.038);
    ctx.lineTo(cx+hw,     by-s*0.080);
    ctx.bezierCurveTo(cx+hw*0.86,by-s*0.125, cx+ww*1.72,by-s*0.190, cx+ww,by-s*0.238);
    ctx.lineTo(cx-ww,     by-s*0.238);
    ctx.bezierCurveTo(cx-ww*1.72,by-s*0.190, cx-hw*0.86,by-s*0.125, cx-hw,by-s*0.080);
    ctx.closePath(); ctx.fill();
    pHL(cx, by-s*0.238, s*0.200, hw*2, isW);
    // Waist collar
    ctx.fillStyle=gCyl(cx,s*0.310,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.148,by-s*0.238); ctx.lineTo(cx+s*0.148,by-s*0.238);
    ctx.lineTo(cx+s*0.148,by-s*0.282); ctx.lineTo(cx-s*0.148,by-s*0.282);
    ctx.closePath(); ctx.fill();
    // Crown cylinder (flares outward for 5 balls)
    var colT=by-s*0.282;
    ctx.fillStyle=gCyl(cx,s*0.428,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.098,colT); ctx.lineTo(cx+s*0.098,colT);
    ctx.lineTo(cx+s*0.208,colT-s*0.098); ctx.lineTo(cx-s*0.208,colT-s*0.098);
    ctx.closePath(); ctx.fill();
    pHL(cx, colT-s*0.098, s*0.098, s*0.428, isW);
    // Crown base rim
    var crBase=colT-s*0.098;
    ctx.strokeStyle=C.glow+'66'; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.ellipse(cx,crBase,s*0.208,s*0.042,0,0,Math.PI*2); ctx.stroke();
    // 5 graduated crown balls
    [
        {dx:-s*0.188, dy:0,       r:s*0.064},
        {dx:-s*0.096, dy:s*0.048, r:s*0.074},
        {dx:0,        dy:s*0.080, r:s*0.084},
        {dx: s*0.096, dy:s*0.048, r:s*0.074},
        {dx: s*0.188, dy:0,       r:s*0.064}
    ].forEach(function(pt){ pBall(cx+pt.dx, crBase-pt.dy, pt.r, isW); });
}

/* ── KING ── tallest piece, ornate cross on top ── */
function pKing(cx, cy, isW) {
    var s=SQ, by=cy+s*0.27, C=gPc(isW);
    pShadow(cx,by);
    pDisk(cx,by,s*0.345,isW);
    var hw=s*0.215, ww=s*0.084;
    // Lower body
    ctx.fillStyle=gCyl(cx,hw*2,isW);
    ctx.beginPath();
    ctx.moveTo(cx-hw*1.18,by-s*0.038); ctx.lineTo(cx+hw*1.18,by-s*0.038);
    ctx.lineTo(cx+hw,     by-s*0.080);
    ctx.bezierCurveTo(cx+hw*0.86,by-s*0.128, cx+ww*1.72,by-s*0.198, cx+ww,by-s*0.248);
    ctx.lineTo(cx-ww,     by-s*0.248);
    ctx.bezierCurveTo(cx-ww*1.72,by-s*0.198, cx-hw*0.86,by-s*0.128, cx-hw,by-s*0.080);
    ctx.closePath(); ctx.fill();
    pHL(cx, by-s*0.248, s*0.210, hw*2, isW);
    // Collar band
    ctx.fillStyle=gCyl(cx,s*0.328,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.158,by-s*0.248); ctx.lineTo(cx+s*0.158,by-s*0.248);
    ctx.lineTo(cx+s*0.158,by-s*0.295); ctx.lineTo(cx-s*0.158,by-s*0.295);
    ctx.closePath(); ctx.fill();
    // Upper neck
    var colT=by-s*0.295;
    ctx.fillStyle=gCyl(cx,s*0.232,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.110,colT); ctx.lineTo(cx+s*0.110,colT);
    ctx.lineTo(cx+s*0.106,colT-s*0.068); ctx.lineTo(cx-s*0.106,colT-s*0.068);
    ctx.closePath(); ctx.fill();
    // Platform ledge
    var platY=colT-s*0.068;
    ctx.fillStyle=gCyl(cx,s*0.405,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.195,platY); ctx.lineTo(cx+s*0.195,platY);
    ctx.lineTo(cx+s*0.195,platY-s*0.050); ctx.lineTo(cx-s*0.195,platY-s*0.050);
    ctx.closePath(); ctx.fill();
    pHL(cx, platY-s*0.050, s*0.050, s*0.405, isW);
    // Cross
    var cb=platY-s*0.050;
    // Vertical bar
    ctx.fillStyle=gCyl(cx,s*0.112,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.056,cb); ctx.lineTo(cx+s*0.056,cb);
    ctx.lineTo(cx+s*0.056,cb-s*0.270); ctx.lineTo(cx-s*0.056,cb-s*0.270);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=isW?'rgba(255,255,255,0.22)':'rgba(190,110,255,0.18)';
    ctx.fillRect(cx-s*0.056, cb-s*0.270, s*0.036, s*0.270);
    // Horizontal bar
    ctx.fillStyle=gCyl(cx,s*0.365,isW);
    ctx.beginPath();
    ctx.moveTo(cx-s*0.180,cb-s*0.165); ctx.lineTo(cx+s*0.180,cb-s*0.165);
    ctx.lineTo(cx+s*0.180,cb-s*0.218); ctx.lineTo(cx-s*0.180,cb-s*0.218);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle=isW?'rgba(255,255,255,0.20)':'rgba(190,110,255,0.16)';
    ctx.fillRect(cx-s*0.180, cb-s*0.218, s*0.365, s*0.025);
    // Glow outlines
    ctx.strokeStyle=C.glow+'aa'; ctx.lineWidth=1.6;
    ctx.strokeRect(cx-s*0.056, cb-s*0.270, s*0.112, s*0.270);
    ctx.strokeRect(cx-s*0.180, cb-s*0.218, s*0.360, s*0.053);
    // Ball at cross top
    pBall(cx, cb-s*0.282, s*0.058, isW);
}

/* ── DRAW PIECE dispatcher ── */
function drawPiece(piece, r, c) {
    var pos=sqXY(r,c), cx=pos.x+SQ/2, cy=pos.y+SQ/2, isW=piece.c==='w';
    switch(piece.t) {
        case 'P': pPawn(cx,cy,isW);   break;
        case 'R': pRook(cx,cy,isW);   break;
        case 'N': pKnight(cx,cy,isW); break;
        case 'B': pBishop(cx,cy,isW); break;
        case 'Q': pQueen(cx,cy,isW);  break;
        case 'K': pKing(cx,cy,isW);   break;
    }
}

/* ── Accent gradient (shared for borders and lines) ── */
function accentGrad(x0, y0, x1, y1) {
    var g=ctx.createLinearGradient(x0,y0,x1,y1);
    g.addColorStop(0,'#8fd3f4'); g.addColorStop(0.5,'#b07898'); g.addColorStop(1,'#ff512f');
    return g;
}

/* ── Board ── */
function sqXY(r,c) { return {x:BX+c*SQ, y:BY+r*SQ}; }

function drawBoard() {
    for (var r=0;r<8;r++) for (var c=0;c<8;c++) {
        var p=sqXY(r,c);
        var isLight=(r+c)%2===0;
        var g=ctx.createLinearGradient(p.x,p.y,p.x+SQ,p.y+SQ);
        if (isLight) { g.addColorStop(0,'#c8a858'); g.addColorStop(1,'#b49040'); }
        else         { g.addColorStop(0,'#253a6a'); g.addColorStop(1,'#142248'); }
        ctx.fillStyle=g; ctx.fillRect(p.x,p.y,SQ,SQ);
    }
    // Gradient border frame
    ctx.strokeStyle=accentGrad(BX,BY,BX+8*SQ,BY+8*SQ);
    ctx.lineWidth=2.5; ctx.strokeRect(BX+1.25,BY+1.25,8*SQ-2.5,8*SQ-2.5);
}

/* ── Highlights ── */
function drawHighlights() {
    if (gs.lastMove) {
        [[gs.lastMove.fr,gs.lastMove.fc],[gs.lastMove.tr,gs.lastMove.tc]].forEach(function(s){
            var p=sqXY(s[0],s[1]); ctx.fillStyle='rgba(255,210,0,0.30)'; ctx.fillRect(p.x,p.y,SQ,SQ);
        });
    }
    if (gs.status==='check'||gs.status==='checkmate') {
        var k=findKing(gs.board,gs.turn);
        if (k) { var p=sqXY(k.r,k.c); ctx.fillStyle='rgba(200,10,10,0.56)'; ctx.fillRect(p.x,p.y,SQ,SQ); }
    }
    if (gs.sel) {
        var p=sqXY(gs.sel.r,gs.sel.c);
        ctx.fillStyle='rgba(143,211,244,0.50)'; ctx.fillRect(p.x,p.y,SQ,SQ);
        ctx.strokeStyle='rgba(143,211,244,0.90)'; ctx.lineWidth=2;
        ctx.strokeRect(p.x+1,p.y+1,SQ-2,SQ-2);
        gs.moves.forEach(function(m){
            var mp=sqXY(m.tr,m.tc), cx2=mp.x+SQ/2, cy2=mp.y+SQ/2;
            if (gs.board[m.tr][m.tc]||m.f==='ep') {
                ctx.strokeStyle='rgba(255,81,47,0.78)'; ctx.lineWidth=SQ*0.11;
                ctx.beginPath(); ctx.arc(cx2,cy2,SQ*0.44,0,Math.PI*2); ctx.stroke();
            } else {
                ctx.fillStyle='rgba(143,211,244,0.52)';
                ctx.beginPath(); ctx.arc(cx2,cy2,SQ*0.19,0,Math.PI*2); ctx.fill();
            }
        });
    }
}

/* ── Coordinates ── */
function drawCoords() {
    ctx.font='10px monospace'; ctx.textBaseline='alphabetic';
    for (var i=0;i<8;i++) {
        ctx.fillStyle=i%2===0?'rgba(37,58,106,0.8)':'rgba(200,168,88,0.75)';
        ctx.textAlign='left'; ctx.fillText(8-i,BX+2,BY+i*SQ+13);
        ctx.fillStyle=(7+i)%2===0?'rgba(37,58,106,0.8)':'rgba(200,168,88,0.75)';
        ctx.textAlign='right'; ctx.fillText('abcdefgh'[i],BX+(i+1)*SQ-2,BY+8*SQ-2);
    }
}

/* ── HUD ── */
function drawHUD() {
    // Top bar
    var gTop=ctx.createLinearGradient(0,0,W,0);
    gTop.addColorStop(0,'#08101e'); gTop.addColorStop(1,'#140810');
    ctx.fillStyle=gTop; ctx.fillRect(0,0,W,BY);
    // Accent line
    ctx.strokeStyle=accentGrad(0,BY,W,BY); ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(0,BY-0.75); ctx.lineTo(W,BY-0.75); ctx.stroke();

    var tx = gs.status==='idle'      ? 'AJEDREZ'
           : gs.status==='checkmate' ? (gs.turn==='w'?'Negras ganan!':'Blancas ganan!')
           : gs.status==='stalemate' ? 'Tablas — ahogado'
           : gs.aiThinking           ? 'IA pensando...'
           : gs.status==='check'     ? (gs.turn==='w'?'¡Jaque a Blancas!':'¡Jaque a Negras!')
           : gs.turn==='w'           ? 'Turno: Blancas' : 'Turno: Negras';
    var txCol = gs.status==='checkmate'||gs.status==='stalemate' ? '#ff512f'
              : gs.status==='check'  ? '#ff8a50'
              : gs.aiThinking        ? '#8fd3f4'
              : '#f0f0f0';
    ctx.fillStyle=txCol; ctx.font='bold 14px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(tx,W/2,BY/2);
    ctx.fillStyle=gs.mode==='ai'?'#8fd3f4':'#ffd54a'; ctx.font='10px monospace'; ctx.textAlign='right';
    ctx.fillText(gs.mode==='ai'?'vs IA':'2P',W-5,BY/2);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';

    // Bottom bar
    var botY=BY+8*SQ;
    var gBot=ctx.createLinearGradient(0,botY,0,H);
    gBot.addColorStop(0,'#140810'); gBot.addColorStop(1,'#08101e');
    ctx.fillStyle=gBot; ctx.fillRect(0,botY,W,H-botY);
    ctx.strokeStyle=accentGrad(0,botY,W,botY); ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(0,botY+0.75); ctx.lineTo(W,botY+0.75); ctx.stroke();

    var wActive=gs.turn==='w'&&gs.status!=='idle'&&gs.status!=='checkmate'&&gs.status!=='stalemate';
    var bActive=gs.turn==='b'&&gs.status!=='idle'&&gs.status!=='checkmate'&&gs.status!=='stalemate';

    // White disc
    var wg=ctx.createRadialGradient(W/2-36,botY+14,3,W/2-36,botY+20,16);
    wg.addColorStop(0,wActive?'#b0ccf0':'#243060'); wg.addColorStop(1,wActive?'#2858a0':'#101828');
    ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(W/2-36,botY+20,16,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=wActive?'#8fd3f4':'#243060'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=wActive?'#041020':'#4a5880';
    ctx.font='bold 11px "Georgia",serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('B',W/2-36,botY+20);

    // Black disc
    var bg=ctx.createRadialGradient(W/2+36,botY+14,3,W/2+36,botY+20,16);
    bg.addColorStop(0,bActive?'#3a1424':'#0e0a14'); bg.addColorStop(1,bActive?'#1a0608':'#060408');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(W/2+36,botY+20,16,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=bActive?'#ff512f':'#2a1020'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle=bActive?'#ffc880':'#5a3028';
    ctx.fillText('N',W/2+36,botY+20);

    // Labels
    ctx.font='9px monospace'; ctx.fillStyle='#555';
    ctx.fillText('Blancas',W/2-36-20,botY+38);
    ctx.fillText('Negras', W/2+36-18,botY+38);
    ctx.textBaseline='alphabetic'; ctx.textAlign='left';
}

/* ── Idle overlay ── */
function drawIdleOverlay() {
    ctx.fillStyle='rgba(4,8,18,0.84)'; ctx.fillRect(BX,BY,8*SQ,8*SQ);
    ctx.fillStyle=accentGrad(W/2-60,BY+4*SQ-22,W/2+60,BY+4*SQ-2);
    ctx.font='bold 30px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('AJEDREZ',W/2,BY+4*SQ-18);
    ctx.font='13px monospace'; ctx.fillStyle='rgba(143,211,244,0.80)';
    ctx.fillText('Pulsa "Nueva Partida"',W/2,BY+4*SQ+22);
    ctx.textBaseline='alphabetic'; ctx.textAlign='left';
}

/* ── Main render ── */
function render() {
    ctx.clearRect(0,0,W,H);
    drawBoard();
    if (gs.status!=='idle') {
        drawHighlights();
        for (var r=0;r<8;r++) for (var c=0;c<8;c++)
            if (gs.board[r][c]) drawPiece(gs.board[r][c],r,c);
        drawCoords();
    } else { drawIdleOverlay(); }
    drawHUD();
}

/* ── Input ── */
function getSquare(px,py) {
    var c=Math.floor((px-BX)/SQ),r=Math.floor((py-BY)/SQ);
    return (r<0||r>7||c<0||c>7)?null:{r:r,c:c};
}
function handleClick(px,py) {
    if (gs.status==='idle'||gs.status==='checkmate'||gs.status==='stalemate') return;
    if (gs.mode==='ai'&&gs.turn===gs.aiColor) return;
    if (gs.aiThinking) return;
    var sq=getSquare(px,py); if (!sq) return;
    if (gs.sel) {
        for (var i=0;i<gs.moves.length;i++) {
            if (gs.moves[i].tr===sq.r&&gs.moves[i].tc===sq.c) {
                var captured=executeMove(gs.moves[i]);
                if      (gs.status==='checkmate') GameAudio.gameOver();
                else if (gs.status==='check')     GameAudio.hit();
                else if (captured)                GameAudio.brick();
                else                              GameAudio.place();
                if (gs.mode==='ai'&&(gs.status==='playing'||gs.status==='check')&&gs.turn===gs.aiColor) {
                    gs.aiThinking=true; setTimeout(doAiMove,300);
                }
                return;
            }
        }
    }
    var p=gs.board[sq.r][sq.c];
    if (p&&p.c===gs.turn) {
        gs.sel=sq; gs.moves=getLegal(gs.board,sq.r,sq.c,gs.ep,gs.castle);
        if (gs.moves.length) GameAudio.click();
    } else { gs.sel=null; gs.moves=[]; }
}

/* ── Events ── */
canvas.addEventListener('click',function(e){
    var rect=canvas.getBoundingClientRect();
    handleClick((e.clientX-rect.left)*(W/rect.width),(e.clientY-rect.top)*(H/rect.height));
});
canvas.addEventListener('touchstart',function(e){
    e.preventDefault();
    var rect=canvas.getBoundingClientRect(),t=e.touches[0];
    handleClick((t.clientX-rect.left)*(W/rect.width),(t.clientY-rect.top)*(H/rect.height));
},{passive:false});

function updateModeLabel() {
    document.querySelectorAll('.btn-mode').forEach(function(b){ b.textContent=gs.mode==='ai'?'vs IA':'2 Jugadores'; });
}
document.querySelectorAll('.btn-new').forEach(function(b){
    b.addEventListener('click',function(){ GameAudio.click(); newGame(); });
});
document.querySelectorAll('.btn-mode').forEach(function(b){
    b.addEventListener('click',function(){
        GameAudio.click(); gs.mode=gs.mode==='ai'?'2p':'ai'; gs.aiColor='b';
        updateModeLabel(); newGame();
    });
});

/* ── Init ── */
gs.board=makeBoard(); gs.castle=freshCastle(); gs.status='idle';
updateMobileScore();
// Throttle to ~60fps on high-refresh screens
var lastRenderTs = 0;
requestAnimationFrame(function loop(ts){
    if (ts - lastRenderTs >= 15) { lastRenderTs = ts; render(); }
    requestAnimationFrame(loop);
});

}());
