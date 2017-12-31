using System;
using System.Collections.Generic;

namespace Tetris.Controllers.Tetris
{
    public class Player
    {
        private const int nextPieceCount = 2;
        public readonly string ConnectionId;

        public readonly Piece[] NextPieces;
        private readonly Queue<DateTime> pendingRemoves;
        private readonly Random random;
        public readonly string UserName;

        public Player(string connectionId, string userName, Random random)
        {
            ConnectionId = connectionId;
            UserName = userName;
            this.random = random;
            NextPieces = new Piece[nextPieceCount + 1];
            for (var i = 0; i < nextPieceCount + 1; i++)
            {
                NextPieces[i] = GenerateSinglePiece();
            }
            pendingRemoves = new Queue<DateTime>();
        }

        private Piece GenerateSinglePiece()
        {
            var id = random.Next(7);
            var rotation = random.Next(4);
            return new Piece(id, rotation);
        }

        public Piece[] GenerateNextPiece()
        {
            for (var i = 0; i < nextPieceCount; i++)
            {
                NextPieces[i] = NextPieces[i + 1];
            }
            NextPieces[nextPieceCount] = GenerateSinglePiece();
            return NextPieces;
        }

        public bool RemovePendingRemove()
        {
            if (pendingRemoves.Count > 0)
            {
                pendingRemoves.Dequeue();
                return true;
            }
            return false;
        }

        public void AddPendingRemove(DateTime when)
        {
            pendingRemoves.Enqueue(when);
        }

        public bool RemovePendingRemoveIfInPast(DateTime now)
        {
            if (pendingRemoves.Count > 0 && pendingRemoves.Peek().CompareTo(now) <= 0)
            {
                pendingRemoves.Dequeue();
                return true;
            }
            return false;
        }

        public double[] GetPendingTimes()
        {
            var items = pendingRemoves.ToArray();
            var result = new double[items.Length];
            var now = DateTime.Now;
            for (var i = 0; i < items.Length; i++)
            {
                result[i] = items[i].Subtract(now).TotalMilliseconds;
            }
            return result;
        }
    }
}