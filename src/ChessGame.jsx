import { useState, useCallback, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const STORAGE_KEY = "chessGame";

const ChessGame = () => {
  const [game, setGame] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const chess = new Chess();
        data.history.forEach((m) => chess.move(m));
        return chess;
      } catch (e) {
        console.error("Error loading saved game:", e);
      }
    }
    return new Chess();
  });

  const [moveLog, setMoveLog] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        return data.moveLog || [];
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

  // 🔹 Save to sessionStorage whenever game or logs/captures change
  useEffect(() => {
    const history = game.history({ verbose: true });
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ history, moveLog, capturedWhite, capturedBlack })
    );
  }, [game, moveLog, capturedWhite, capturedBlack]);

  // Chess symbols helper
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

  // Drag & drop moves
  const onDrop = useCallback((sourceSquare, targetSquare) => {
    let moveMade = false;

    setGame((prev) => {
      const next = new Chess();
      prev.history({ verbose: true }).forEach((m) => next.move(m));

      if (next.isGameOver()) return prev;

      const piece = next.get(sourceSquare);
      if (!piece || piece.color !== next.turn()) return prev;

      const move = next.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move) {
        setMoveLog((log) => [
          ...log,
          `${move.color === "w" ? "White" : "Black"}: ${move.san}`,
        ]);

        // track captures
        if (move.captured) {
          if (move.color === "w") {
            setCapturedWhite((prev) => [...prev, move.captured]);
          } else {
            setCapturedBlack((prev) => [...prev, move.captured]);
          }
        }

        setSelectedSquare(null);
        setLegalMoves([]);
        moveMade = true;
        return next;
      }
      return prev;
    });

    return moveMade;
  }, []);

  // Tap-to-move handler
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
    game.history({ verbose: true }).forEach((m) => next.move(m));

    const move = next.move({
      from: selectedSquare,
      to: square,
      promotion: "q",
    });

    if (move) {
      setGame(next);
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
    }
  };

  const undoMove = () => {
    setGame((prev) => {
      const next = new Chess();
      prev.history({ verbose: true }).forEach((m) => next.move(m));

      const undone = next.undo();
      if (undone) {
        setMoveLog((m) => m.slice(0, -1));

        // Remove last captured piece if any
        if (undone.captured) {
          if (undone.color === "w") {
            setCapturedWhite((prev) => prev.slice(0, -1));
          } else {
            setCapturedBlack((prev) => prev.slice(0, -1));
          }
        }

        setSelectedSquare(null);
        setLegalMoves([]);
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
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const getGameStatus = () => {
    if (game.isGameOver()) {
      if (game.isCheckmate()) return "Checkmate!";
      if (game.isDraw()) return "Draw!";
      if (game.isStalemate()) return "Stalemate!";
      return "Game Over!";
    }
    if (game.isCheck()) return "Check!";
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
    color: game.isCheck() ? "#d32f2f" : "#333",
  };

  // // Highlight styles
  // const highlightStyles = {};
  // if (selectedSquare) {
  //   highlightStyles[selectedSquare] = {
  //     backgroundColor: "rgba(255, 215, 0, 0.6)",
  //   };
  // }
  // legalMoves.forEach((sq) => {
  //   highlightStyles[sq] = {
  //     background:
  //       "radial-gradient(circle, rgba(0,0,0,0.3) 20%, transparent 20%)",
  //     borderRadius: "50%",
  //   };
  // });

    // Highlight styles
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

        {/* Buttons row */}
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
    </div>
  );
};

export default ChessGame;