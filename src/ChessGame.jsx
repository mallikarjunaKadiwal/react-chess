import { useState, useCallback, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const STORAGE_KEY = "chessGame";

const ChessGame = () => {
  // Keep the mutable Chess instance in a ref — never directly in React state.
  const chessRef = useRef(new Chess());

  // Initialize fen and other saved arrays from sessionStorage (if present).
  const [fen, setFen] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.fen) {
          chessRef.current.load(data.fen);
          return data.fen;
        } else if (data.pgn) {
          chessRef.current.loadPgn(data.pgn);
          return chessRef.current.fen();
        }
      } catch (e) {
        console.error("Error loading saved game:", e);
      }
    }
    return chessRef.current.fen();
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

  // persist only serializable data
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          fen,
          pgn: chessRef.current.pgn(),
          moveLog,
          capturedWhite,
          capturedBlack,
        })
      );
    } catch (e) {
      console.error("Error saving game to sessionStorage:", e);
    }
  }, [fen, moveLog, capturedWhite, capturedBlack]);

  // helper icons
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

  const recordMoveEffects = useCallback((move) => {
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
  }, []);

  const finishPromotion = useCallback(
    (promotionPiece) => {
      const { from, to } = pendingPromotion || {};
      if (!from || !to) {
        setPendingPromotion(null);
        return;
      }
      const game = chessRef.current;
      try {
        const move = game.move({ from, to, promotion: promotionPiece });
        if (move) {
          setFen(game.fen());
          recordMoveEffects(move);
        }
      } catch (e) {
        console.error("Error finishing promotion:", e);
      }
      setPendingPromotion(null);
    },
    [pendingPromotion, recordMoveEffects]
  );

  const onDrop = useCallback(
    (sourceSquare, targetSquare) => {
      const game = chessRef.current;

      // quick guard
      if (!game) return false;
      if (game.isGameOver()) return false;

      try {
        const piece = game.get(sourceSquare);
        if (!piece || piece.color !== game.turn()) return false;

        const legalFrom = game.moves({ square: sourceSquare, verbose: true });
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
          return false;
        }

        const move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });

        if (move) {
          setFen(game.fen());
          recordMoveEffects(move);
          return true;
        }
      } catch (err) {
        // don't crash — log and ignore
        console.error("Invalid move attempt:", err);
      }
      return false;
    },
    [recordMoveEffects]
  );

  const handleSquareClick = (square) => {
    const game = chessRef.current;
    if (!game || game.isGameOver()) return;

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

    try {
      const legalFrom = game.moves({
        square: selectedSquare,
        verbose: true,
      });
      const promoNeeded = legalFrom.some(
        (m) => m.to === square && m.promotion
      );
      if (promoNeeded) {
        const p = game.get(selectedSquare);
        setPendingPromotion({
          from: selectedSquare,
          to: square,
          color: p?.color || toMove,
        });
        return;
      }

      const move = game.move({
        from: selectedSquare,
        to: square,
        promotion: "q",
      });
      if (move) {
        setFen(game.fen());
        recordMoveEffects(move);
      }
    } catch (e) {
      console.error("handleSquareClick error:", e);
    }
  };

  // Undo logic
  const undoMove = useCallback(() => {
    const game = chessRef.current;
    try {
      const undone = game.undo();
      if (undone) {
        setFen(game.fen());
        setMoveLog((m) => m.slice(0, -1));
        if (undone.captured) {
          if (undone.color === "w") {
            setCapturedWhite((prev) => prev.slice(0, -1));
          } else {
            setCapturedBlack((prev) => prev.slice(0, -1));
          }
        }
      }
    } catch (e) {
      console.error("undoMove error:", e);
    }
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);
  }, []);

  // Reset the whole game
  const resetGame = useCallback(() => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setMoveLog([]);
    setCapturedWhite([]);
    setCapturedBlack([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPendingPromotion(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error("Error clearing storage:", e);
    }
  }, []);

  // Game status derived from chessRef
  const getGameStatus = () => {
    const game = chessRef.current;
    if (!game) return "";
    if (game.isGameOver()) {
      if (game.isCheckmate()) return "Checkmate!";
      if (game.isDraw()) return "Draw!";
      if (game.isStalemate()) return "Stalemate!";
      return "Game Over!";
    }
    if (game.inCheck()) return "Check!";
    return `${game.turn() === "w" ? "White" : "Black"} to move`;
  };

  // UI styles (kept same as your original)
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
    color: chessRef.current && chessRef.current.inCheck() ? "#d32f2f" : "#333",
  };

  // Square highlight styles
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

  // highlight king if in check / checkmate
  if (chessRef.current && (chessRef.current.inCheck() || chessRef.current.isCheckmate())) {
    const board = chessRef.current.board();
    let kingSquare = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === "k" && piece.color === chessRef.current.turn()) {
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
          position={fen}
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
        <h2 style={{ marginBottom: "15px", fontSize: "18px" }}>Move History</h2>
        <div style={moveListStyle}>
          {moveLog.length > 0 ? (
            moveLog.map((move, index) => (
              <div key={index} style={moveItemStyle}>
                {`${Math.floor(index / 2) + 1}. ${move}`}
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
                <button key={t} style={promoBtnStyle} onClick={() => finishPromotion(t)}>
                  {promoSymbol(t, pendingPromotion.color)}
                </button>
              ))}
            </div>
            <button style={cancelBtnStyle} onClick={() => setPendingPromotion(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessGame;