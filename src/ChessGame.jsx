import { useState, useCallback, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const STORAGE_KEY = "chessGame";

const ChessGame = () => {
  const [game, setGame] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const chess = new Chess();
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.fen) {
          chess.load(data.fen);
        } else if (data.pgn) {
          chess.loadPgn(data.pgn);
        }
      } catch (e) {
        console.error("Error loading saved game:", e);
      }
    }
    return chess;
  });

  const [moveLog, setMoveLog] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).moveLog || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [capturedWhite, setCapturedWhite] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).capturedWhite || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [capturedBlack, setCapturedBlack] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).capturedBlack || [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  // persist game safely
  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        fen: game.fen(),
        pgn: game.pgn(),
        moveLog,
        capturedWhite,
        capturedBlack,
      })
    );
  }, [game, moveLog, capturedWhite, capturedBlack]);

  const promoSymbol = (type, color) => {
    const map = {
      q: { w: "♕", b: "♛" },
      r: { w: "♖", b: "♜" },
      b: { w: "♗", b: "♝" },
      n: { w: "♘", b: "♞" },
    };
    return map[type][color];
  };

  const pieceSymbol = (piece, color, key) => {
    const symbols = {
      p: { w: "♙", b: "♟" },
      n: { w: "♘", b: "♞" },
      b: { w: "♗", b: "♝" },
      r: { w: "♖", b: "♜" },
      q: { w: "♕", b: "♛" },
      k: { w: "♔", b: "♚" },
    };
    return (
      <span key={key} style={{ fontSize: "22px", margin: "2px" }}>
        {symbols[piece][color]}
      </span>
    );
  };

  const recordMoveEffects = (move) => {
    setMoveLog((log) => [
      ...log,
      `${move.color === "w" ? "White" : "Black"}: ${move.san}`,
    ]);
    if (move.captured) {
      if (move.color === "w") {
        setCapturedWhite((prev) => [...prev, move.captured]);
      } else {
        setCapturedBlack((prev) => [...prev, move.captured]);
      }
    }
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  const finishPromotion = (promotionPiece) => {
    const { from, to } = pendingPromotion || {};
    if (!from || !to) {
      setPendingPromotion(null);
      return;
    }

    setGame((prev) => {
      const next = new Chess();
      next.load(prev.fen());

      const move = next.move({ from, to, promotion: promotionPiece });
      if (move) {
        recordMoveEffects(move);
      }
      setPendingPromotion(null);
      return next;
    });
  };

  const onDrop = useCallback(
    (sourceSquare, targetSquare) => {
      let moveMade = false;
      try {
        setGame((prev) => {
          const next = new Chess();
          next.load(prev.fen());

          if (next.isGameOver()) return prev;

          const piece = next.get(sourceSquare);
          if (!piece || piece.color !== next.turn()) {
            return prev; // invalid source
          }

          const legalFrom = next.moves({ square: sourceSquare, verbose: true });
          const isPromotion = legalFrom.some(
            (m) => m.to === targetSquare && m.promotion
          );
          if (isPromotion) {
            setPendingPromotion({
              from: sourceSquare,
              to: targetSquare,
              color: piece.color,
            });
            setSelectedSquare(null);
            setLegalMoves([]);
            return prev;
          }

          const move = next.move({
            from: sourceSquare,
            to: targetSquare,
            promotion: "q",
          });

          if (move) {
            recordMoveEffects(move);
            moveMade = true;
            return next;
          }

          return prev;
        });
      } catch (err) {
        console.error("Invalid move attempt:", err);
      }
      return moveMade;
    },
    [recordMoveEffects]
  );

  const handleSquareClick = (square) => {
    if (game.isGameOver()) return;

    const piece = game.get(square);
    const toMove = game.turn();

    if (!selectedSquare) {
      if (piece && piece.color === toMove) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true }).map((m) => m.to);
        setLegalMoves(moves);
      }
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (piece && piece.color === toMove) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true }).map((m) => m.to);
      setLegalMoves(moves);
      return;
    }

    const next = new Chess();
    next.load(game.fen());

    const legalFrom = next.moves({ square: selectedSquare, verbose: true });
    const promoNeeded = legalFrom.some((m) => m.to === square && m.promotion);
    if (promoNeeded) {
      const p = game.get(selectedSquare);
      setPendingPromotion({
        from: selectedSquare,
        to: square,
        color: p?.color || toMove,
      });
      return;
    }

    const move = next.move({
      from: selectedSquare,
      to: square,
      promotion: "q",
    });

    if (move) {
      setGame(next);
      recordMoveEffects(move);
    }
  };

  const undoMove = () => {
    setGame((prev) => {
      const next = new Chess();
      next.load(prev.fen());

      const undone = next.undo();
      if (undone) {
        setMoveLog((m) => m.slice(0, -1));
        if (undone.captured) {
          if (undone.color === "w") {
            setCapturedWhite((prev) => prev.slice(0, -1));
          } else {
            setCapturedBlack((prev) => prev.slice(0, -1));
          }
        }
        setSelectedSquare(null);
        setLegalMoves([]);
        setPendingPromotion(null);
        return next;
      }
      return prev;
    });
  };

  const resetGame = () => {
    const fresh = new Chess();
    setGame(fresh);
    setMoveLog([]);
    setCapturedWhite([]);
    setCapturedBlack([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const getGameStatus = () => {
    if (game.isGameOver()) {
      if (game.isCheckmate()) return "Checkmate!";
      if (game.isDraw()) return "Draw!";
      if (game.isStalemate()) return "Stalemate!";
      return "Game Over!";
    }
    if (game.inCheck()) return "Check!";
    return `${game.turn() === "w" ? "White" : "Black"} to move`;
  };

  const containerStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    display: "flex",
    gap: "20px",
    flexDirection: window.innerWidth < 768 ? "column" : "row",
  };

  const boardContainerStyle = { flex: 2, maxWidth: "600px" };
  const moveLogStyle = {
    flex: 1,
    border: "1px solid #ccc",
    borderRadius: "4px",
    padding: "15px",
  };
  const moveListStyle = {
    height: "400px",
    overflowY: "auto",
    border: "1px solid #eee",
    padding: "10px",
  };
  const moveItemStyle = {
    padding: "8px",
    borderBottom: "1px solid #eee",
    backgroundColor: "#fff",
  };
  const buttonStyle = {
    padding: "8px 16px",
    backgroundColor: "#2196f3",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginTop: "15px",
  };
  const statusStyle = {
    fontSize: "20px",
    marginBottom: "15px",
    textAlign: "center",
    color: game.inCheck() ? "#d32f2f" : "#333",
  };

  const highlightStyles = {};
  if (selectedSquare) {
    highlightStyles[selectedSquare] = {
      backgroundColor: "rgba(255, 215, 0, 0.6)",
    };
  }
  legalMoves.forEach((sq) => {
    highlightStyles[sq] = {
      background:
        "radial-gradient(circle, rgba(0,0,0,0.3) 20%, transparent 20%)",
      borderRadius: "50%",
    };
  });

  if (game.inCheck() || game.isCheckmate()) {
    const board = game.board();
    let kingSquare = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === "k" && piece.color === game.turn()) {
          const file = "abcdefgh"[col];
          const rank = 8 - row;
          kingSquare = `${file}${rank}`;
        }
      }
    }
    if (kingSquare) {
      highlightStyles[kingSquare] = {
        backgroundColor: "rgba(255, 0, 0, 0.6)",
      };
    }
  }

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  };
  const modalStyle = {
    background: "rgba(119, 153, 82, 0.9)",
    padding: "16px",
    borderRadius: "8px",
    width: "280px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    textAlign: "center",
  };
  const promoRowStyle = {
    display: "flex",
    gap: "10px",
    justifyContent: "center",
    margin: "10px 0",
  };
  const promoBtnStyle = {
    fontSize: "28px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    cursor: "pointer",
    background: "#f7f7f7",
  };
  const cancelBtnStyle = {
    marginTop: "8px",
    padding: "6px 10px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    background: "#eee",
  };

  return (
    <div style={containerStyle}>
      <div style={boardContainerStyle}>
        <div style={statusStyle}>{getGameStatus()}</div>
        <Chessboard
          position={game.fen()}
          onPieceDrop={onDrop}
          onSquareClick={handleSquareClick}
          customBoardStyle={{
            borderRadius: "4px",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
          }}
          customDarkSquareStyle={{ backgroundColor: "#779952" }}
          customLightSquareStyle={{ backgroundColor: "#edeed1" }}
          customSquareStyles={highlightStyles}
        />

        <div style={{ marginTop: "10px", textAlign: "center" }}>
          <div>
            <strong>White captured: </strong>
            {capturedWhite.map((p, i) => pieceSymbol(p, "b", i))}
          </div>
          <div>
            <strong>Black captured: </strong>
            {capturedBlack.map((p, i) => pieceSymbol(p, "w", i))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
          <button
            onClick={resetGame}
            style={buttonStyle}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#1976d2")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#2196f3")
            }
          >
            New Game
          </button>
          <button
            onClick={undoMove}
            style={{ ...buttonStyle, backgroundColor: "#f44336" }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#d32f2f")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#f44336")
            }
          >
            Undo
          </button>
        </div>
      </div>

      <div style={moveLogStyle}>
        <h2 style={{ marginBottom: "15px", fontSize: "18px" }}>
          Move History
        </h2>
        <div style={moveListStyle}>
          {moveLog.length > 0 ? (
            moveLog
              .reduce((rows, move, i) => {
                if (i % 2 === 0) {
                  rows.push([move]); // White move starts new row
                } else {
                  rows[rows.length - 1].push(move); // Black move added
                }
                return rows;
              }, [])
              .map((pair, rowIndex) => (
                <div key={rowIndex} style={moveItemStyle}>
                  {`${rowIndex + 1}. ${pair[0]} ${pair[1] || ""}`}
                </div>
              ))
          ) : (
            <div
              style={{ textAlign: "center", color: "#666", fontStyle: "italic" }}
            >
              No moves yet
            </div>
          )}
        </div>
      </div>

      {pendingPromotion && (
        <div style={overlayStyle} onClick={() => setPendingPromotion(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 600 }}>Promote to?</div>
            <div style={promoRowStyle}>
              {["q", "r", "b", "n"].map((t) => (
                <button
                  key={t}
                  style={promoBtnStyle}
                  onClick={() => finishPromotion(t)}
                >
                  {promoSymbol(t, pendingPromotion.color)}
                </button>
              ))}
            </div>
            <button
              style={cancelBtnStyle}
              onClick={() => setPendingPromotion(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessGame;