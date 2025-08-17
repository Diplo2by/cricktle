document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const guessInput = document.getElementById('guess-input');
    const guessButton = document.getElementById('guess-button');
    const guessesContainer = document.getElementById('guesses-container');
    const messageArea = document.getElementById('message-area');
    const suggestionsContainer = document.getElementById('suggestions');
    const gameOverModal = document.getElementById('game-over-modal');
    const modalContent = document.getElementById('modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const playAgainButton = document.getElementById('play-again-button');
    const guessesLeftDisplay = document.getElementById('guesses-left');

    // --- Game State ---
    let players = [];
    let secretPlayer = null;
    let guessesLeft = 6;
    let gameOver = false;
    const MAX_GUESSES = 6;

    // --- Game Initialization ---
    async function initGame() {
        // Show loading state
        setLoadingState(true);

        // Fetch player data from the JSON file
        try {
            const response = await fetch('players.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            players = await response.json();
        } catch (error) {
            console.error('Could not load player data:', error);
            showMessage('Error: Failed to load player data. Make sure players.json exists.', 'error');
            guessButton.disabled = true;
            guessInput.disabled = true;
            setLoadingState(false);
            return;
        }

        secretPlayer = players[Math.floor(Math.random() * players.length)];
        guessesLeft = MAX_GUESSES;
        gameOver = false;

        // Clear UI
        resetUI();
        updateGuessCounter();
        setLoadingState(false);

        console.log("Secret Player:", secretPlayer.name); // For debugging
    }

    // --- UI Helper Functions ---
    function resetUI() {
        guessesContainer.innerHTML = `
            <div class="grid grid-cols-8 gap-1 sm:gap-2 text-xs sm:text-sm font-semibold text-gray-300 uppercase tracking-wider px-1 sm:px-2">
                <div class="text-center min-w-16 sm:min-w-20">Name</div>
                <div class="text-center min-w-16 sm:min-w-20">Country</div>
                <div class="text-center min-w-16 sm:min-w-20">Role</div>
                <div class="text-center min-w-16 sm:min-w-20">Matches</div>
                <div class="text-center min-w-16 sm:min-w-20">Runs</div>
                <div class="text-center min-w-16 sm:min-w-20">Wickets</div>
                <div class="text-center min-w-16 sm:min-w-20">Average</div>
                <div class="text-center min-w-16 sm:min-w-20">Era</div>
            </div>
        `;
        messageArea.textContent = '';
        guessInput.value = '';
        guessInput.disabled = false;
        guessButton.disabled = false;
        gameOverModal.classList.add('hidden');
        modalContent.classList.add('scale-95', 'opacity-0');
        suggestionsContainer.classList.add('hidden');
    }

    function updateGuessCounter() {
        guessesLeftDisplay.textContent = guessesLeft;
        guessesLeftDisplay.classList.remove('danger');

        // Add warning styling when guesses are low
        if (guessesLeft <= 2) {
            guessesLeftDisplay.classList.add('danger');
        }
    }

    function setLoadingState(loading) {
        const container = document.querySelector('.max-w-6xl');
        if (loading) {
            container.classList.add('loading');
        } else {
            container.classList.remove('loading');
        }
    }

    // --- Event Listeners ---
    guessButton.addEventListener('click', handleGuess);

    guessInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            handleGuess();
        } else if (e.key === 'ArrowDown') {
            focusFirstSuggestion();
        } else if (e.key === 'Escape') {
            suggestionsContainer.classList.add('hidden');
        }
    });

    guessInput.addEventListener('input', handleAutocomplete);
    playAgainButton.addEventListener('click', initGame);

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!guessInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.add('hidden');
        }
    });

    // --- Accessibility Helper Functions ---
    function focusFirstSuggestion() {
        const firstSuggestion = suggestionsContainer.querySelector('div');
        if (firstSuggestion) {
            firstSuggestion.focus();
        }
    }

    function addKeyboardNavigationToSuggestions() {
        const suggestions = suggestionsContainer.querySelectorAll('div');
        suggestions.forEach((item, index) => {
            item.setAttribute('tabindex', '0');
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectSuggestion(item.textContent);
                } else if (e.key === 'ArrowDown' && index < suggestions.length - 1) {
                    e.preventDefault();
                    suggestions[index + 1].focus();
                } else if (e.key === 'ArrowUp' && index > 0) {
                    e.preventDefault();
                    suggestions[index - 1].focus();
                } else if (e.key === 'Escape') {
                    suggestionsContainer.classList.add('hidden');
                    guessInput.focus();
                }
            });
        });
    }

    function selectSuggestion(name) {
        guessInput.value = name;
        suggestionsContainer.classList.add('hidden');
        guessInput.focus();
    }

    // --- Main Guess Logic ---
    function handleGuess() {
        if (gameOver || !players.length) return;

        const guessName = guessInput.value.trim();
        if (!guessName) {
            showMessage("Please enter a player name.", "error");
            return;
        }

        const guessedPlayer = players.find(p => p.name.toLowerCase() === guessName.toLowerCase());

        suggestionsContainer.classList.add('hidden');
        guessInput.value = '';

        if (!guessedPlayer) {
            showMessage("Player not found. Please try again.", "error");
            return;
        }

        guessesLeft--;
        updateGuessCounter();
        displayGuess(guessedPlayer);

        if (guessedPlayer.name === secretPlayer.name) {
            endGame(true);
        } else if (guessesLeft === 0) {
            endGame(false);
        } else {
            // Focus back on input for next guess
            setTimeout(() => {
                guessInput.focus();
            }, 500);
        }
    }

    // --- Autocomplete Logic ---
    function handleAutocomplete() {
        const query = guessInput.value.toLowerCase();
        if (query.length < 2) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const filteredPlayers = players
            .map(p => p.name)
            .filter(name => name.toLowerCase().includes(query))
            .slice(0, 8); // Limit suggestions to prevent overwhelming on mobile

        if (filteredPlayers.length > 0) {
            suggestionsContainer.innerHTML = filteredPlayers.map(name =>
                `<div class="p-3 hover:bg-gray-700 cursor-pointer border-b border-gray-600 last:border-b-0">${name}</div>`
            ).join('');
            suggestionsContainer.classList.remove('hidden');

            // Add click and keyboard event listeners
            document.querySelectorAll('#suggestions > div').forEach(item => {
                item.addEventListener('click', () => selectSuggestion(item.textContent));
            });

            addKeyboardNavigationToSuggestions();
        } else {
            suggestionsContainer.classList.add('hidden');
        }
    }

    // --- UI Update Functions ---
    function displayGuess(guessedPlayer) {
        const guessRow = document.createElement('div');
        guessRow.className = 'grid grid-cols-8 gap-1 sm:gap-2';

        const attributes = ['name', 'country', 'role', 'matches', 'runs', 'wickets', 'average', 'era'];

        attributes.forEach((attr, index) => {
            const cell = createCell(guessedPlayer, attr);
            guessRow.appendChild(cell);
            // Stagger the animation
            setTimeout(() => {
                cell.classList.add('flipped');
            }, index * 100);
        });

        guessesContainer.appendChild(guessRow);
    }

    function createCell(guessedPlayer, attribute) {
        const cell = document.createElement('div');
        cell.className = 'relative h-12 sm:h-16 md:h-20 guess-grid-cell min-w-16 sm:min-w-20';

        const front = document.createElement('div');
        front.className = 'front w-full h-full flex items-center justify-center p-1 sm:p-2 text-center bg-gray-700 rounded-lg text-xs sm:text-sm md:text-base font-medium';
        front.textContent = formatCellValue(guessedPlayer[attribute]);

        const back = document.createElement('div');
        const { className, content } = getComparison(guessedPlayer, attribute);
        back.className = `back w-full h-full flex items-center justify-center p-1 sm:p-2 text-center rounded-lg text-xs sm:text-sm md:text-base font-bold ${className}`;
        back.innerHTML = content;

        cell.appendChild(front);
        cell.appendChild(back);
        return cell;
    }

    function formatCellValue(value) {
        if (typeof value === 'number') {
            // Format large numbers with commas
            return value.toLocaleString();
        }
        return value;
    }

    function getComparison(guessedPlayer, attribute) {
        const guessedValue = guessedPlayer[attribute];
        const secretValue = secretPlayer[attribute];

        if (guessedValue === secretValue) {
            return { className: 'correct', content: formatCellValue(guessedValue) };
        }

        if (typeof guessedValue === 'number') {
            const arrow = guessedValue < secretValue ? '▲' : '▼';
            return {
                className: 'close',
                content: `${formatCellValue(guessedValue)} <span class="text-sm sm:text-lg">${arrow}</span>`
            };
        }

        // For string attributes that don't match
        return { className: 'incorrect', content: formatCellValue(guessedValue) };
    }

    function showMessage(msg, type = 'info') {
        messageArea.textContent = msg;
        messageArea.className = `text-center h-6 sm:h-8 mb-4 font-medium text-sm sm:text-base ${type === 'error' ? 'text-red-400' : 'text-yellow-400'}`;

        // Announce to screen readers
        messageArea.setAttribute('aria-live', 'polite');

        setTimeout(() => {
            if (messageArea.textContent === msg) {
                messageArea.textContent = '';
                messageArea.removeAttribute('aria-live');
            }
        }, 3000);
    }

    // --- Game Over Logic ---
    function endGame(isWin) {
        gameOver = true;
        guessInput.disabled = true;
        guessButton.disabled = true;

        setTimeout(() => {
            if (isWin) {
                modalTitle.textContent = 'Congratulations! 🎉';
                modalText.innerHTML = `You guessed <strong>"${secretPlayer.name}"</strong> correctly!<br>You had ${guessesLeft} guess${guessesLeft === 1 ? '' : 'es'} remaining.`;
            } else {
                modalTitle.textContent = 'Game Over! 😔';
                modalText.innerHTML = `The correct player was <strong>"${secretPlayer.name}"</strong>.<br>Better luck next time!`;
            }
            gameOverModal.classList.remove('hidden');

            // Focus on modal for accessibility
            modalContent.focus();

            setTimeout(() => {
                modalContent.classList.remove('scale-95', 'opacity-0');
            }, 50); // Small delay for transition to trigger
        }, 1000); // Wait for the last flip animation to complete
    }

    // --- Touch and Mobile Optimizations ---
    function optimizeForTouch() {
        // Add touch event handling for better mobile experience
        let touchStartY = 0;

        suggestionsContainer.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        suggestionsContainer.addEventListener('touchend', (e) => {
            const touchEndY = e.changedTouches[0].clientY;
            const deltaY = Math.abs(touchEndY - touchStartY);

            // If it's a small movement (likely a tap), handle as click
            if (deltaY < 10) {
                const target = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
                if (target && target.parentElement === suggestionsContainer) {
                    selectSuggestion(target.textContent);
                }
            }
        });
    }

    // --- Initialize game and mobile optimizations ---
    optimizeForTouch();
    initGame();

    // Focus on input when page loads (but not on mobile to avoid keyboard popup)
    if (window.innerWidth > 640) {
        setTimeout(() => guessInput.focus(), 100);
    }
});