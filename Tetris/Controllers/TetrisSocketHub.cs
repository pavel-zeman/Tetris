using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.SignalR;
using Tetris.Controllers.Tetris;

namespace Tetris.Controllers
{
    public class TetrisSocketHub : Hub
    {
        /// <summary>
        /// Dictionary of existing games indexed by connection ID.
        /// Each game is referenced twice - once for each player.
        /// </summary>
        private static readonly ConcurrentDictionary<string, Game> games = new ConcurrentDictionary<string, Game>();

        /// <summary>
        /// Dictionary of connection IDs waiting for opponent (connection ID -> player name).
        /// </summary>
        private static readonly ConcurrentDictionary<string, string> waitingIds = new ConcurrentDictionary<string, string>();


        /// <summary>
        /// Connection IDs of players looking for an opponent (connection ID -> true). In fact, this is a set, but there is no concurrent set, so we use a dictionary.
        /// </summary>
        private static readonly ConcurrentDictionary<string, bool> tryingToJoinIds = new ConcurrentDictionary<string, bool>();

        private static Game GetGame(string connectionId)
        {
            Game game;
            // ReSharper disable once InconsistentlySynchronizedField
            if (games.TryGetValue(connectionId, out game))
            {
                return game;
            }
            throw new ApplicationException("Invalid connection ID");
        }

        private Player GetOtherPlayer()
        {
            return GetGame(Context.ConnectionId).GetOtherPlayer(Context.ConnectionId);
        }

        private Player GetPlayer()
        {
            return GetGame(Context.ConnectionId).GetPlayer(Context.ConnectionId);
        }


        /// <summary>
        /// Starts waiting for an opponent.
        /// </summary>
        /// <param name="name">Player name</param>
        public void WaitForOpponent(string name)
        {
            lock (games)
            {
                waitingIds.AddOrUpdate(Context.ConnectionId, name, (key, value) => value);
                SendWaitingList();
            }
        }

        /// <summary>
        /// Shows list of existing opponents.
        /// </summary>
        /// <param name="name">Current player name (currently ignored)</param>
        /// <returns>List of currrently waiting players.</returns>
        public List<WaitingPlayer> FindOpponent(string name)
        {
            lock (games)
            {
                tryingToJoinIds.AddOrUpdate(Context.ConnectionId, true, (key, value) => value);
                return GetWaitingPlayers();
            }
        }

        /// <summary>
        /// Stops waiting for an opponent.
        /// </summary>
        public void StopWaiting()
        {
            lock (games)
            {
                string dummy;
                if (waitingIds.TryRemove(Context.ConnectionId, out dummy))
                {
                    SendWaitingList();
                }
            }
        }


        /// <summary>
        /// Picks a waiting player from the list and starts a new game.
        /// </summary>
        /// <param name="otherConnectionId">Picked connection ID</param>
        public void PickWaitingPlayer(string otherConnectionId)
        {
            lock (games)
            {
                bool dummy;
                tryingToJoinIds.TryRemove(Context.ConnectionId, out dummy);
                string otherUserName;
                if (waitingIds.TryRemove(otherConnectionId, out otherUserName))
                {
                    var game = new Game(Context.ConnectionId, Context.User.Identity.GetUserName(), otherConnectionId, otherUserName);
                    foreach (var player in game.Players)
                    {
                        games.AddOrUpdate(player.ConnectionId, game, (key, value) => value);
                    }
                    foreach (var player in game.Players)
                    {
                        Clients.Client(player.ConnectionId).StartGame(player.UserName, game.GetOtherPlayer(player.ConnectionId).UserName,
                            player.NextPieces, game.GetOtherPlayer(player.ConnectionId).NextPieces);
                    }
                }
                else
                {
                    throw new ApplicationException("Player not waiting any more");
                }
            }
        }


        /// <summary>
        /// Invoked to indicate, that a single piece made it all the way to the bottom of the shaft.
        /// </summary>
        /// <param name="rowsRemoved">Number of rows removed</param>
        /// <returns>Updated game status</returns>
        public DropResult Dropped(int rowsRemoved)
        {
            var game = GetGame(Context.ConnectionId);
            lock (game) { 
                var thisPlayer = GetPlayer();
                var otherPlayer = GetOtherPlayer();
               if (rowsRemoved > 0)
                {
                    var rowsRemaining = rowsRemoved;
                    while (rowsRemaining > 0 && thisPlayer.RemovePendingRemove())
                    {
                        rowsRemaining--;
                    }
                    while (rowsRemaining > 0)
                    {
                        otherPlayer.AddPendingRemove(DateTime.Now.AddSeconds(Game.TimeToRemoveRow));
                        rowsRemaining--;
                    }
                }

                var now = DateTime.Now;
                var garbageRows = 0;
                while (thisPlayer.RemovePendingRemoveIfInPast(now))
                {
                    garbageRows++;
                }
                var dropResult = new DropResult
                {
                    Garbage = garbageRows > 0 ? GenerateGarbage(game, garbageRows) : null,
                    PendingTimes = new[] {thisPlayer.GetPendingTimes(), otherPlayer.GetPendingTimes()},
                    NewPieces = thisPlayer.GenerateNextPiece()
                };
                Clients.Client(otherPlayer.ConnectionId).OtherDropped(dropResult);
                return dropResult;
            }
        }

        /// <summary>
        /// Invoked, when current piece was moved by offset to the right (the offset can be negative to indicate move to the left).
        /// </summary>
        /// <param name="offset">Offset (+1 or -1)</param>
        public void Move(int offset)
        {
            Clients.Client(GetOtherPlayer().ConnectionId).otherMove(offset);
        }

        /// <summary>
        /// Invoked, when current piece was rotated.
        /// </summary>
        public void Rotate()
        {
            Clients.Client(GetOtherPlayer().ConnectionId).otherRotate();
        }

        /// <summary>
        /// Invoked, when current piece was moved one position down.
        /// </summary>
        public void Down()
        {
            Clients.Client(GetOtherPlayer().ConnectionId).otherDown();
        }

        /// <summary>
        /// Generates given number of rows of garbage.
        /// </summary>
        /// <param name="game">Current game</param>
        /// <param name="count">Number of rows of garbage to generate</param>
        /// <returns></returns>
        private static string[] GenerateGarbage(Game game, int count)
        {
            var result = new string[count];
            for (var i = 0; i < count; i++)
            {
                var row = new StringBuilder();
                for (var j = 0; j < Game.ShaftWidth; j++)
                {
                    row.Append(game.Random(100) >= 50 ? '0' : (char) ('1' + game.Random(7)));
                }
                result[i] = row.ToString();
            }
            return result;
        }


        /// <summary>
        /// Invoked, when current player lost.
        /// </summary>
        public void Lost()
        {
            lock (games)
            {
                var otherPlayer = GetOtherPlayer();
                Clients.Client(otherPlayer.ConnectionId).ThisWin();
                Game dummy;
                games.TryRemove(otherPlayer.ConnectionId, out dummy);
                games.TryRemove(GetPlayer().ConnectionId, out dummy);
            }
        }


        /// <summary>
        /// Generates list of waiting players.
        /// </summary>
        private static List<WaitingPlayer> GetWaitingPlayers()
        {
            return waitingIds.Select(item => new WaitingPlayer(item.Key, item.Value))
                    .OrderBy(player => player.UserName)
                    .ThenBy(player => player.ConnectionId)
                    .ToList();
        } 

        /// <summary>
        /// Sends a list of players waiting for an opponent to all waiting players or a single player identified by the input connection ID.
        /// </summary>
        private void SendWaitingList()
        {
            // Store the list of waiting players so that we send the same list to every player
            var waitingPlayers = GetWaitingPlayers();
            foreach (var entry in tryingToJoinIds)
            {
                Clients.Client(entry.Key).UpdateWaitingList(waitingPlayers);
            }
        }

        /// <summary>
        /// Removes current player from the list of players trying to find an opponent.
        /// </summary>
        public void RemoveJoiningPlayer()
        {
            lock (games)
            {
                bool dummy;
                tryingToJoinIds.TryRemove(Context.ConnectionId, out dummy);
            }
        }

        /// <summary>
        /// Disconnection handler. Removes current connection from the waiting lists.
        /// </summary>
        /// <param name="stopCalled"></param>
        /// <returns></returns>
        public override Task OnDisconnected(bool stopCalled)
        {
            lock (games)
            {
                string userName;
                if (waitingIds.TryRemove(Context.ConnectionId, out userName))
                {
                    SendWaitingList();
                }
                bool dummy;
                tryingToJoinIds.TryRemove(Context.ConnectionId, out dummy);
                return base.OnDisconnected(stopCalled);
            }
        }
    }
}