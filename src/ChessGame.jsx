import { useState, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

const ChessGame = () => {
  const [game, setGame] = useState(() => new Chess()); // lazy init
  const [moveLog, setMoveLog] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);

  // Drag & drop moves
  const onDrop = useCallback((sourceSquare, targetSquare) => {
    let moveMade = false;

    setGame((prev) => {
      const next = new Chess();
      prev.history({ verbose: true }).forEach((m) => next.move(m));

      if (next.isGameOver()) return prev;

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

    // Nothing selected -> select if it's the side to move
    if (!selectedSquare) {
      if (piece && piece.color === toMove) {
        setSelectedSquare(square);
        // show legal moves
        const moves = game.moves({ square, verbose: true }).map((m) => m.to);
        setLegalMoves(moves);
      }
      return;
    }

    // Tapping same square -> deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // Switch selection if another friendly piece is tapped
    if (piece && piece.color === toMove) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true }).map((m) => m.to);
      setLegalMoves(moves);
      return;
    }

    // Try to make a move
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
        setSelectedSquare(null);
        setLegalMoves([]);
        return next;
      }
      return prev;
    });
  };

  const resetGame = () => {
    setGame(new Chess());
    setMoveLog([]);
    setSelectedSquare(null);
    setLegalMoves([]);
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

  // Styles
  const containerStyle = {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px",
    display: "flex",
    gap: "20px",
    flexDirection: window.innerWidth < 768 ? "column" : "row",
  };

  const boardContainerStyle = {
    flex: 2,
    maxWidth: "600px",
  };

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

  // Highlight styles
  const highlightStyles = {};
  if (selectedSquare) {
    highlightStyles[selectedSquare] = {
      backgroundColor: "rgba(255, 223, 43, 0.6)",
    };
  }
  legalMoves.forEach((sq) => {
    highlightStyles[sq] = {
      background:
        "radial-gradient(circle, rgba(0,0,0,0.3) 20%, transparent 20%)",
      borderRadius: "50%",
    };
  });

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