// ===== Blackjack — Canvas =====
'use strict';

const CW = 400, CH = 600;
const STARTING_BANK = 500;
const CARD_W = 64, CARD_H = 92;
const CARD_GAP = 26;          // horizontal overlap step between stacked cards
const DEAL_SPEED = 0.14;      // lerp factor for sliding deal animation
const FLIP_SPEED = 0.12;      // lerp factor for hole-card flip

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// ---- State ----
const canvas = document.getElementById('blackjackCanvas');
const ctx = canvas.getContext('2d');

const game = {
    phase: 'betting',   // betting | dealing | player | dealer | result
    bank: STARTING_BANK,
    bet: 0,
    deck: [],
    player: [],
    dealer: [],
    holeRevealed: false,
    holeFlip: 0,        // 0 = face down, 1 = face up
    message: '',
    messageColor: '#fff',
    canDouble: false,
    doubled: false,
    buttons: [],        // clickable regions {id,x,y,w,h,label,enabled,kind}
    bgGrad: null
};

// ---- localStorage bank ----
function loadBank() {
    let v = parseInt(localStorage.getItem('blackjackBank'), 10);
    if (!Number.isFinite(v) || v <= 0) v = STARTING_BANK;
    game.bank = v;
    saveBank();
}
function saveBank() {
    try { localStorage.setItem('blackjackBank', String(game.bank)); } catch (e) {}
    const el = document.getElementById('bank');
    if (el) el.textContent = game.bank;
    updateMobileScore();
}
function updateMobileScore() {
    const el = document.getElementById('mobileScore');
    if (el) el.textContent = 'Saldo: ' + game.bank + '   Apuesta: ' + game.bet;
}

// ---- Deck ----
function buildDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
    // Fisher-Yates (not in render path)
    for (let i = d.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        const t = d[i]; d[i] = d[j]; d[j] = t;
    }
    return d;
}
function drawCard() {
    if (game.deck.length === 0) game.deck = buildDeck();
    return game.deck.pop();
}
function cardValue(rank) {
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return parseInt(rank, 10);
}
function handTotal(hand) {
    let total = 0, aces = 0;
    for (const c of hand) {
        total += cardValue(c.rank);
        if (c.rank === 'A') aces++;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
}
function isBlackjack(hand) {
    return hand.length === 2 && handTotal(hand) === 21;
}

// ---- Card animation helpers ----
// Each card has render position (rx,ry) that lerps toward target (tx,ty).
function makeCardSlot(card, tx, ty, faceUp) {
    return {
        card,
        rx: CW + 60, ry: -40,   // start off-screen (top-right, like a shoe)
        tx, ty,
        faceUp,
        arrived: false
    };
}

// ---- Game flow ----
function startGame() {
    GameAudio.click();
    loadBank();
    game.phase = 'betting';
    game.bet = 0;
    game.player = [];
    game.dealer = [];
    game.message = 'Haz tu apuesta';
    game.messageColor = '#8fd3f4';
    game.doubled = false;
    hidePopup();
    updateMobileScore();
}

function placeBet(amount) {
    if (game.phase !== 'betting') return;
    if (amount > game.bank) return;
    GameAudio.click();
    game.bet += amount;
    if (game.bet > game.bank) game.bet = game.bank;
    updateMobileScore();
}

function clearBet() {
    if (game.phase !== 'betting') return;
    GameAudio.click();
    game.bet = 0;
    updateMobileScore();
}

function deal() {
    if (game.phase !== 'betting' || game.bet <= 0) return;
    GameAudio.click();
    GameAudio.start();
    game.bank -= game.bet;
    saveBank();
    game.deck = buildDeck();
    game.player = [];
    game.dealer = [];
    game.holeRevealed = false;
    game.holeFlip = 0;
    game.message = '';
    game.doubled = false;
    game.phase = 'dealing';
    resetSlots();

    // Deal order: player, dealer, player, dealer(hole)
    const seq = [
        { hand: game.player, faceUp: true },
        { hand: game.dealer, faceUp: true },
        { hand: game.player, faceUp: true },
        { hand: game.dealer, faceUp: false }
    ];
    let step = 0;
    function dealNext() {
        if (step >= seq.length) {
            game.canDouble = (game.bank >= game.bet);
            afterDeal();
            return;
        }
        const s = seq[step++];
        s.hand.push(drawCard());
        setCardTargets();
        setTimeout(dealNext, 260);
    }
    dealNext();
}

function afterDeal() {
    const pBJ = isBlackjack(game.player);
    const dBJ = isBlackjack(game.dealer);
    if (pBJ || dBJ) {
        game.phase = 'dealer';
        revealHole();
        setTimeout(resolve, 700);
    } else {
        game.phase = 'player';
        game.message = 'Tu turno';
        game.messageColor = '#fff';
    }
}

function hit() {
    if (game.phase !== 'player') return;
    GameAudio.click();
    game.canDouble = false;
    game.player.push(drawCard());
    setCardTargets();
    const total = handTotal(game.player);
    if (total > 21) {
        setTimeout(() => { endHand('bust'); }, 500);
    } else if (total === 21) {
        setTimeout(stand, 500);
    }
}

function stand() {
    if (game.phase !== 'player') return;
    GameAudio.click();
    game.phase = 'dealer';
    game.canDouble = false;
    revealHole();
    setTimeout(dealerPlay, 650);
}

function doubleDown() {
    if (game.phase !== 'player' || !game.canDouble) return;
    if (game.bank < game.bet) return;
    GameAudio.click();
    game.bank -= game.bet;
    game.bet *= 2;
    game.doubled = true;
    saveBank();
    game.player.push(drawCard());
    setCardTargets();
    game.canDouble = false;
    const total = handTotal(game.player);
    if (total > 21) {
        setTimeout(() => { endHand('bust'); }, 500);
    } else {
        setTimeout(stand, 600);
    }
}

function revealHole() {
    if (game.holeRevealed) return;
    game.holeRevealed = true;
    GameAudio.flip();
    // hole slot will animate flip in update loop
}

function dealerPlay() {
    if (game.phase !== 'dealer') return;
    function step() {
        if (handTotal(game.dealer) < 17) {
            game.dealer.push(drawCard());
            setCardTargets();
            setTimeout(step, 600);
        } else {
            setTimeout(resolve, 500);
        }
    }
    step();
}

function resolve() {
    const p = handTotal(game.player);
    const d = handTotal(game.dealer);
    const pBJ = isBlackjack(game.player);
    const dBJ = isBlackjack(game.dealer);

    if (pBJ && dBJ) { endHand('push'); return; }
    if (pBJ) { endHand('blackjack'); return; }
    if (dBJ) { endHand('lose'); return; }
    if (p > 21) { endHand('bust'); return; }
    if (d > 21) { endHand('win'); return; }
    if (p > d) { endHand('win'); return; }
    if (p < d) { endHand('lose'); return; }
    endHand('push');
}

function endHand(outcome) {
    game.phase = 'result';
    let payout = 0;
    switch (outcome) {
        case 'blackjack':
            payout = game.bet + Math.floor(game.bet * 1.5);
            game.message = '¡Blackjack! Ganas';
            game.messageColor = '#ffd700';
            game.bank += payout;
            GameAudio.scoreHigh();
            break;
        case 'win':
            payout = game.bet * 2;
            game.message = '¡Ganas!';
            game.messageColor = '#7CFC7C';
            game.bank += payout;
            GameAudio.score();
            break;
        case 'push':
            payout = game.bet;
            game.message = 'Empate';
            game.messageColor = '#8fd3f4';
            game.bank += payout;
            GameAudio.click();
            break;
        case 'bust':
            game.message = 'Te pasaste. Pierdes';
            game.messageColor = '#ff6b6b';
            GameAudio.gameOver();
            break;
        case 'lose':
        default:
            game.message = 'Pierdes';
            game.messageColor = '#ff6b6b';
            GameAudio.gameOver();
            break;
    }
    saveBank();

    if (game.bank <= 0) {
        setTimeout(() => {
            game.bank = STARTING_BANK;
            saveBank();
            showPopup('Sin saldo', 'Te quedaste sin fichas.', 'Saldo restaurado a ' + STARTING_BANK);
        }, 900);
    }
}

function nextRound() {
    GameAudio.click();
    game.phase = 'betting';
    game.bet = 0;
    game.player = [];
    game.dealer = [];
    game.message = 'Haz tu apuesta';
    game.messageColor = '#8fd3f4';
    updateMobileScore();
}

function restartBank() {
    GameAudio.click();
    game.bank = STARTING_BANK;
    saveBank();
    game.bet = 0;
    game.phase = 'betting';
    game.player = [];
    game.dealer = [];
    game.message = 'Saldo restaurado. Haz tu apuesta';
    game.messageColor = '#8fd3f4';
}

// ---- Card target positioning (slots & lerp) ----
let playerSlots = [];
let dealerSlots = [];

function handX(count, i) {
    const totalW = CARD_W + (count - 1) * CARD_GAP;
    const startX = (CW - totalW) / 2;
    return startX + i * CARD_GAP;
}

function setCardTargets() {
    const dealerY = 70;
    const playerY = CH - 240;

    // Reconcile dealerSlots with game.dealer
    syncSlots(dealerSlots, game.dealer, dealerY, true);
    syncSlots(playerSlots, game.player, playerY, false);
}

function syncSlots(slots, hand, y, isDealer) {
    // add new slots
    for (let i = slots.length; i < hand.length; i++) {
        const faceUp = isDealer ? (i !== 1) : true; // dealer index 1 is hole card
        slots.push(makeCardSlot(hand[i], handX(hand.length, i), y, faceUp));
    }
    // remove extra slots (e.g. on reset)
    if (slots.length > hand.length) slots.length = hand.length;
    // update targets for all
    for (let i = 0; i < slots.length; i++) {
        slots[i].tx = handX(hand.length, i);
        slots[i].ty = y;
        slots[i].card = hand[i];
    }
}

function resetSlots() {
    playerSlots = [];
    dealerSlots = [];
}

// ---- Update (state only) ----
function update() {
    // lerp card positions
    for (const s of playerSlots) {
        s.rx += (s.tx - s.rx) * DEAL_SPEED;
        s.ry += (s.ty - s.ry) * DEAL_SPEED;
        if (Math.abs(s.rx - s.tx) < 0.5 && Math.abs(s.ry - s.ty) < 0.5) s.arrived = true;
    }
    for (const s of dealerSlots) {
        s.rx += (s.tx - s.rx) * DEAL_SPEED;
        s.ry += (s.ty - s.ry) * DEAL_SPEED;
        if (Math.abs(s.rx - s.tx) < 0.5 && Math.abs(s.ry - s.ty) < 0.5) s.arrived = true;
    }
    // hole flip
    if (game.holeRevealed && game.holeFlip < 1) {
        game.holeFlip += FLIP_SPEED;
        if (game.holeFlip > 1) game.holeFlip = 1;
        if (dealerSlots[1]) dealerSlots[1].faceUp = game.holeFlip >= 0.5;
    }

    buildButtons();
}

function buildButtons() {
    game.buttons = [];
    if (game.phase === 'betting') {
        // chips
        const chips = [5, 25, 100];
        const cw = 64, gap = 14;
        const totalW = chips.length * cw + (chips.length - 1) * gap;
        let x = (CW - totalW) / 2;
        const y = CH - 210;
        for (const c of chips) {
            game.buttons.push({ id: 'chip' + c, kind: 'chip', value: c, x, y, w: cw, h: cw, enabled: c <= game.bank });
            x += cw + gap;
        }
        // clear + deal
        game.buttons.push({ id: 'clear', kind: 'btn', label: 'Limpiar', x: CW / 2 - 150, y: CH - 110, w: 140, h: 56, enabled: game.bet > 0 });
        game.buttons.push({ id: 'deal', kind: 'btn', label: 'Repartir', x: CW / 2 + 10, y: CH - 110, w: 140, h: 56, enabled: game.bet > 0 });
    } else if (game.phase === 'player') {
        game.buttons.push({ id: 'hit', kind: 'btn', label: 'Pedir', x: 16, y: CH - 80, w: 110, h: 60, enabled: true });
        game.buttons.push({ id: 'stand', kind: 'btn', label: 'Plantarse', x: 145, y: CH - 80, w: 110, h: 60, enabled: true });
        game.buttons.push({ id: 'double', kind: 'btn', label: 'Doblar', x: 274, y: CH - 80, w: 110, h: 60, enabled: game.canDouble && game.bank >= game.bet });
    } else if (game.phase === 'result') {
        game.buttons.push({ id: 'next', kind: 'btn', label: 'Siguiente mano', x: CW / 2 - 110, y: CH - 80, w: 220, h: 60, enabled: true });
    }
}

// ---- Input ----
function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    let cx, cy;
    if (e.touches && e.touches.length) {
        cx = e.touches[0].clientX; cy = e.touches[0].clientY;
    } else {
        cx = e.clientX; cy = e.clientY;
    }
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
}

function handleClick(p) {
    for (const b of game.buttons) {
        if (!b.enabled) continue;
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
            dispatch(b);
            return;
        }
    }
}

function dispatch(b) {
    if (b.kind === 'chip') { placeBet(b.value); return; }
    switch (b.id) {
        case 'clear': clearBet(); break;
        case 'deal': deal(); break;
        case 'hit': hit(); break;
        case 'stand': stand(); break;
        case 'double': doubleDown(); break;
        case 'next': nextRound(); break;
    }
}

canvas.addEventListener('mousedown', (e) => { handleClick(canvasPoint(e)); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleClick(canvasPoint(e)); }, { passive: false });

// ---- Rendering ----
function makeBgGrad() {
    const g = ctx.createRadialGradient(CW / 2, CH / 2, 60, CW / 2, CH / 2, 380);
    g.addColorStop(0, '#11653a');
    g.addColorStop(1, '#063018');
    return g;
}

function draw() {
    if (!game.bgGrad) game.bgGrad = makeBgGrad();
    ctx.fillStyle = game.bgGrad;
    ctx.fillRect(0, 0, CW, CH);

    drawTableMarkings();
    drawHands();
    drawTotals();
    drawMessage();
    drawBankBar();
    drawButtons();
}

function drawTableMarkings() {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CW / 2, 40, 200, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();

    ctx.fillStyle = 'rgba(143,211,244,0.55)';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BLACKJACK PAGA 3 A 2', CW / 2, 200);
    ctx.font = '11px Arial';
    ctx.fillText('La banca pide hasta 17', CW / 2, 218);
}

function drawHands() {
    // dealer
    for (const s of dealerSlots) drawCardSlot(s);
    // player
    for (const s of playerSlots) drawCardSlot(s);
}

function drawCardSlot(s) {
    const x = s.rx, y = s.ry;
    // flipping animation only for the hole card while it reveals
    let scaleX = 1;
    if (s === dealerSlots[1] && game.holeRevealed && game.holeFlip < 1) {
        scaleX = Math.abs(game.holeFlip - 0.5) * 2; // 1 -> 0 -> 1
    }
    const cx = x + CARD_W / 2;
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(scaleX, 1);
    ctx.translate(-cx, 0);
    if (s.faceUp) drawCardFace(x, y, s.card);
    else drawCardBack(x, y);
    ctx.restore();
}

function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCardBack(x, y) {
    roundRectPath(x, y, CARD_W, CARD_H, 8);
    ctx.fillStyle = '#1a2980';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8fd3f4';
    ctx.stroke();
    // diamond lattice pattern
    ctx.save();
    roundRectPath(x + 6, y + 6, CARD_W - 12, CARD_H - 12, 5);
    ctx.clip();
    ctx.strokeStyle = 'rgba(143,211,244,0.5)';
    ctx.lineWidth = 1;
    for (let i = -CARD_H; i < CARD_W; i += 10) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + i + CARD_H, y + CARD_H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + i + CARD_H, y);
        ctx.lineTo(x + i, y + CARD_H);
        ctx.stroke();
    }
    ctx.restore();
}

function drawCardFace(x, y, card) {
    roundRectPath(x, y, CARD_W, CARD_H, 8);
    ctx.fillStyle = '#fbfbf5';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#d0d0c0';
    ctx.stroke();

    const red = (card.suit === 'hearts' || card.suit === 'diamonds');
    const color = red ? '#d11a2a' : '#1a1a1a';

    // rank corners
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(card.rank, x + 6, y + 20);
    ctx.save();
    ctx.translate(x + CARD_W - 6, y + CARD_H - 8);
    ctx.rotate(Math.PI);
    ctx.fillText(card.rank, 0, 0);
    ctx.restore();

    // small suit under top rank
    drawSuit(x + 11, y + 30, 7, card.suit, color);
    // center pip (large)
    drawSuit(x + CARD_W / 2, y + CARD_H / 2, 15, card.suit, color);
}

// draw a suit symbol centered at (cx,cy) with given "radius" size
function drawSuit(cx, cy, size, suit, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (suit === 'hearts') {
        const s = size;
        ctx.moveTo(cx, cy + s * 0.75);
        ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.4, cx - s * 0.55, cy - s, cx, cy - s * 0.35);
        ctx.bezierCurveTo(cx + s * 0.55, cy - s, cx + s * 1.3, cy - s * 0.4, cx, cy + s * 0.75);
        ctx.closePath();
        ctx.fill();
    } else if (suit === 'diamonds') {
        const s = size;
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s * 0.75, cy);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s * 0.75, cy);
        ctx.closePath();
        ctx.fill();
    } else if (suit === 'spades') {
        const s = size;
        ctx.moveTo(cx, cy - s);
        ctx.bezierCurveTo(cx + s * 1.2, cy + s * 0.25, cx + s * 0.45, cy + s * 0.7, cx, cy + s * 0.25);
        ctx.bezierCurveTo(cx - s * 0.45, cy + s * 0.7, cx - s * 1.2, cy + s * 0.25, cx, cy - s);
        ctx.closePath();
        ctx.fill();
        // stem
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.1);
        ctx.lineTo(cx - s * 0.35, cy + s);
        ctx.lineTo(cx + s * 0.35, cy + s);
        ctx.closePath();
        ctx.fill();
    } else { // clubs
        const s = size * 0.55;
        ctx.arc(cx, cy - s * 0.7, s, 0, Math.PI * 2);
        ctx.arc(cx - s * 0.85, cy + s * 0.45, s, 0, Math.PI * 2);
        ctx.arc(cx + s * 0.85, cy + s * 0.45, s, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.5, cy + s * 1.7);
        ctx.lineTo(cx + s * 0.5, cy + s * 1.7);
        ctx.closePath();
        ctx.fill();
    }
}

function drawTotals() {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Arial';

    // dealer total (hide while hole is down)
    if (game.dealer.length) {
        let dt;
        if (!game.holeRevealed) {
            dt = (game.dealer[0] ? cardValue(game.dealer[0].rank) : 0) + ' + ?';
        } else {
            dt = handTotal(game.dealer);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('Banca: ' + dt, CW / 2, 178);
    }
    if (game.player.length) {
        ctx.fillStyle = '#fff';
        ctx.fillText('Tú: ' + handTotal(game.player), CW / 2, CH - 252);
    }
}

function drawMessage() {
    if (!game.message) return;
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = game.messageColor;
    ctx.fillText(game.message, CW / 2, CH / 2 + 6);
}

function drawBankBar() {
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('Saldo: ' + game.bank, 14, 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8fd3f4';
    ctx.fillText('Apuesta: ' + game.bet, CW - 14, 26);
}

function drawButtons() {
    for (const b of game.buttons) {
        if (b.kind === 'chip') drawChip(b);
        else drawTextButton(b);
    }
}

const CHIP_COLORS = { 5: '#d11a2a', 25: '#1a8a3a', 100: '#222' };
function drawChip(b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2 - 2;
    ctx.globalAlpha = b.enabled ? 1 : 0.35;
    // body
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = CHIP_COLORS[b.value] || '#444';
    ctx.fill();
    // dashed rim
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // inner circle
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 11, 0, Math.PI * 2);
    ctx.stroke();
    // value
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(b.value), cx, cy + 6);
    ctx.globalAlpha = 1;
}

function drawTextButton(b) {
    ctx.globalAlpha = b.enabled ? 1 : 0.4;
    roundRectPath(b.x, b.y, b.w, b.h, 10);
    const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    g.addColorStop(0, '#8fd3f4');
    g.addColorStop(1, '#ff512f');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = '#181818';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
    ctx.globalAlpha = 1;
}

// ---- Popup ----
function showPopup(title, body, best) {
    document.getElementById('popupTitle').textContent = title;
    document.getElementById('finalScore').textContent = body;
    document.getElementById('finalBest').textContent = best || '';
    document.getElementById('gameOverPopup').style.display = 'flex';
}
function hidePopup() {
    document.getElementById('gameOverPopup').style.display = 'none';
}

// ---- Loop ----
let lastFrameTs = 0;
function loop(ts) {
    if (ts - lastFrameTs < 15) { requestAnimationFrame(loop); return; }
    lastFrameTs = ts;
    update();
    draw();
    requestAnimationFrame(loop);
}

// ---- Wire DOM ----
document.getElementById('startBtn').addEventListener('click', () => {
    resetSlots();
    startGame();
});
document.getElementById('restartBtn').addEventListener('click', restartBank);
document.getElementById('restartBtn').disabled = false;
document.getElementById('playAgainBtn').addEventListener('click', () => {
    hidePopup();
    GameAudio.click();
    game.phase = 'betting';
    game.bet = 0;
    game.player = [];
    game.dealer = [];
    resetSlots();
    game.message = 'Haz tu apuesta';
    game.messageColor = '#8fd3f4';
    updateMobileScore();
});

// init
loadBank();
game.message = 'Pulsa Iniciar para jugar';
game.messageColor = '#8fd3f4';
updateMobileScore();
requestAnimationFrame(loop);
