// src/overlayRenderer.ts
// HUD Overlay Renderer for Move List and Game Info
// Renders directly to a 2D canvas on top of the 3D scene

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

const FONT_FAMILY = '"Old Standard TT", "Times New Roman", serif';
const LIST_WIDTH = 200;
const LIST_HEIGHT = 300;
const PADDING = 15;
const ROW_HEIGHT = 24;
const BG_COLOR = 'rgba(250, 246, 237, 0.9)'; // Parchment-like
const BORDER_COLOR = '#8b7355';
const TEXT_COLOR = '#2a2a2a';
const HIGHLIGHT_COLOR = 'rgba(139, 69, 19, 0.15)';
const HEADER_HEIGHT = 40;

// =============================================================================
// STATE
// =============================================================================

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let moves: string[] = [];
let scrollOffset = 0; // Number of rows scrolled down
let maxVisibleRows = 0;
let isVisible = true;

// =============================================================================
// INITIALIZATION
// =============================================================================

export function init(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Could not get 2D overlay context');
    }
    ctx = context;

    // DISABLED: Resize handler was causing constant redraws
    // resize();
    // window.addEventListener('resize', resize);

    console.log('[Overlay] Initialized move list HUD (drawing disabled for performance)');
}

function resize(): void {
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        // Don't redraw on resize - causes lag
        // draw();
    }
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function updateMoves(newMoves: string[]): void {
    moves = newMoves;

    // Auto-scroll to bottom
    maxVisibleRows = Math.floor((LIST_HEIGHT - HEADER_HEIGHT - PADDING) / ROW_HEIGHT);
    const totalRows = Math.ceil(moves.length / 2); // 2 moves per row

    if (totalRows > maxVisibleRows) {
        scrollOffset = totalRows - maxVisibleRows;
    } else {
        scrollOffset = 0;
    }

    draw();
}

export function setVisible(visible: boolean): void {
    isVisible = visible;
    draw();
}

// =============================================================================
// DRAWING
// =============================================================================

function draw(): void {
    if (!ctx || !isVisible) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Position: Top Right with margin
    const x = canvas.width - LIST_WIDTH - 20;
    const y = 20;

    drawPanel(x, y);
    drawHeader(x, y);
    drawMoveContent(x, y);
}

function drawPanel(x: number, y: number): void {
    ctx.save();

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(x, y, LIST_WIDTH, LIST_HEIGHT);

    // Border
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, LIST_WIDTH, LIST_HEIGHT);

    // Inner detail line
    ctx.strokeStyle = 'rgba(139, 115, 85, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 4, y + 4, LIST_WIDTH - 8, LIST_HEIGHT - 8);

    ctx.restore();
}

function drawHeader(x: number, y: number): void {
    ctx.save();

    const centerX = x + LIST_WIDTH / 2;
    const headerY = y + 25;

    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillStyle = '#4a3a2a'; // Dark brown
    ctx.textAlign = 'center';
    ctx.fillText('Move History', centerX, headerY);

    // Separator line
    ctx.beginPath();
    ctx.moveTo(x + 10, y + HEADER_HEIGHT);
    ctx.lineTo(x + LIST_WIDTH - 10, y + HEADER_HEIGHT);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.stroke();

    ctx.restore();
}

function drawMoveContent(x: number, y: number): void {
    ctx.save();

    // Clip content area
    ctx.beginPath();
    ctx.rect(x + 2, y + HEADER_HEIGHT, LIST_WIDTH - 4, LIST_HEIGHT - HEADER_HEIGHT - 2);
    ctx.clip();

    const startY = y + HEADER_HEIGHT + 20; // Plus some padding
    const totalRows = Math.ceil(moves.length / 2);

    // Start drawing from scrollOffset
    let currentY = startY;

    // Only draw visible rows
    const visibleStartRow = scrollOffset;
    const visibleEndRow = scrollOffset + maxVisibleRows + 1;

    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';

    for (let i = 0; i < totalRows; i++) {
        // Skip if outside visible range
        if (i < visibleStartRow) continue;
        if (i > visibleEndRow) break;

        // Calculate vertical position relative to scrolled view
        const renderY = startY + (i - scrollOffset) * ROW_HEIGHT;

        // Highlight active row (last one)
        if (i === totalRows - 1) {
            ctx.fillStyle = HIGHLIGHT_COLOR;
            ctx.fillRect(x + 6, renderY - 14, LIST_WIDTH - 12, ROW_HEIGHT);
        }

        const moveNum = i + 1;
        const whiteMove = moves[i * 2] || '';
        const blackMove = moves[i * 2 + 1] || '';

        // Draw Move Number
        ctx.fillStyle = '#6a5a4a'; // Muted brown
        ctx.fillText(`${moveNum}.`, x + 15, renderY);

        // Draw White Move
        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(whiteMove, x + 50, renderY);

        // Draw Black Move
        if (blackMove) {
            ctx.fillText(blackMove, x + 120, renderY);
        }
    }

    // Draw scrollbar indicator if needed
    if (totalRows > maxVisibleRows) {
        const scrollBarHeight = (maxVisibleRows / totalRows) * (LIST_HEIGHT - HEADER_HEIGHT - 10);
        const scrollBarY = y + HEADER_HEIGHT + 5 + (scrollOffset / totalRows) * (LIST_HEIGHT - HEADER_HEIGHT - 10);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(x + LIST_WIDTH - 6, scrollBarY, 4, scrollBarHeight);
    }

    ctx.restore();
}
