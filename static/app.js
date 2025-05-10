// API endpoints
const API_BASE = 'http://localhost:5000/api';

// DOM Elements
const rootQuestionForm = document.getElementById('rootQuestionForm');
const questionsTree = document.getElementById('questionsTree');
const questionTemplate = document.getElementById('questionTemplate');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    loadQuestions();
    rootQuestionForm.addEventListener('submit', handleRootQuestionSubmit);
});

// Load all questions
async function loadQuestions() {
    try {
        const response = await fetch(`${API_BASE}/questions`);
        const questions = await response.json();
        questionsTree.innerHTML = ''; // Clear the tree first
        questions.forEach(question => {
            const questionElement = createQuestionElement(question, 0);
            questionsTree.appendChild(questionElement);
        });
    } catch (error) {
        console.error('Error loading questions:', error);
    }
}

// Render questions recursively
function renderQuestions(questions, container = questionsTree, level = 0) {
    container.innerHTML = '';
    questions.forEach(question => {
        const questionElement = createQuestionElement(question, level);
        container.appendChild(questionElement);
    });
}

function formatTimeRemaining(targetDate) {
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target - now;
    
    if (diff < 0) {
        return 'Overdue';
    }
    
    const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
    const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (months > 0) {
        result += `${months} month${months > 1 ? 's' : ''}`;
    }
    if (days > 0) {
        if (result) result += ' and ';
        result += `${days} day${days > 1 ? 's' : ''}`;
    }
    
    return result ? `${result} remaining` : 'Due today';
}

function updateTimeRemaining(timeFrameInput, timeRemainingSpan) {
    if (timeFrameInput.value) {
        const remaining = formatTimeRemaining(timeFrameInput.value);
        timeRemainingSpan.textContent = remaining;
    } else {
        timeRemainingSpan.textContent = '';
    }
}

// Create question element from template
function createQuestionElement(question, level) {
    const element = questionTemplate.content.cloneNode(true);
    const questionItem = element.querySelector('.question-item');
    
    // Set nesting level for color coding
    questionItem.setAttribute('data-level', level);
    questionItem.setAttribute('data-question-id', question.id);
    
    // Set question text and time frame
    const questionTextInput = questionItem.querySelector('.question-text');
    const timeFrameInput = questionItem.querySelector('.time-frame');
    const timeRemainingSpan = questionItem.querySelector('.time-remaining');
    
    questionTextInput.value = question.text;
    if (question.time_frame) {
        timeFrameInput.value = question.time_frame;
        updateTimeRemaining(timeFrameInput, timeRemainingSpan);
    }

    // Add delete button for non-root questions
    if (level > 0) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-red-400 hover:text-red-300 text-xs ml-2';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = async () => {
            if (confirm('Are you sure you want to delete this question and all its children?')) {
                try {
                    await fetch(`${API_BASE}/questions/${question.id}`, {
                        method: 'DELETE'
                    });
                    loadQuestions(); // Reload to update the tree
                } catch (error) {
                    console.error('Error deleting question:', error);
                }
            }
        };
        questionItem.querySelector('.flex.items-center.gap-2').appendChild(deleteBtn);
    }

    // Set up auto-save for question text
    let textTimeout;
    questionTextInput.addEventListener('input', () => {
        clearTimeout(textTimeout);
        textTimeout = setTimeout(() => {
            updateQuestion(question.id, {
                text: questionTextInput.value,
                time_frame: timeFrameInput.value
            });
        }, 500);
    });

    // Set up auto-save for time frame
    timeFrameInput.addEventListener('change', () => {
        updateTimeRemaining(timeFrameInput, timeRemainingSpan);
        updateQuestion(question.id, {
            text: questionTextInput.value,
            time_frame: timeFrameInput.value
        });
    });

    // Update remaining time every minute
    if (timeFrameInput.value) {
        setInterval(() => {
            updateTimeRemaining(timeFrameInput, timeRemainingSpan);
        }, 60000);
    }

    // Set up fold button
    const foldBtn = questionItem.querySelector('.fold-btn');
    const questionContent = questionItem.querySelector('.question-content');
    foldBtn.addEventListener('click', () => {
        foldBtn.classList.toggle('folded');
        questionContent.classList.toggle('folded');
    });

    // Set up event listeners
    questionItem.querySelector('.add-child-btn').addEventListener('click', () => {
        showAddChildForm(question.id, questionItem.querySelector('.children-container'));
    });

    // Render to-resolve items
    const toResolveList = questionItem.querySelector('.to-resolve-list');
    if (question.to_resolve) {
        question.to_resolve.forEach(item => {
            const li = createToResolveItem(item.text, item.completed, item.id);
            toResolveList.appendChild(li);
        });
    }

    // Set up to-resolve form
    const toResolveForm = questionItem.querySelector('.add-to-resolve-form');
    let isSubmitting = false; // Add flag to prevent duplicate submissions
    toResolveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSubmitting) return; // Prevent duplicate submissions
        
        const input = toResolveForm.querySelector('input');
        const text = input.value.trim();
        if (text) {
            try {
                isSubmitting = true; // Set flag before submission
                const response = await fetch(`${API_BASE}/questions/${question.id}/to-resolve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                });
                const newItem = await response.json();
                const li = createToResolveItem(newItem.text, false, newItem.id);
                toResolveList.appendChild(li);
                input.value = '';
            } catch (error) {
                console.error('Error adding to-resolve item:', error);
            } finally {
                isSubmitting = false; // Reset flag after submission
            }
        }
    });

    // Set current answer
    const currentAnswerText = questionItem.querySelector('.current-answer-text');
    if (question.current_answer) {
        currentAnswerText.textContent = question.current_answer;
    }

    // Set up answer form
    const answerForm = questionItem.querySelector('.add-answer-form');
    answerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textarea = answerForm.querySelector('textarea');
        const text = textarea.value.trim();
        if (text) {
            try {
                await addAnswer(question.id, text);
                currentAnswerText.textContent = text;
                textarea.value = '';
            } catch (error) {
                console.error('Error adding answer:', error);
            }
        }
    });

    // Render children recursively
    if (question.children && question.children.length > 0) {
        const childrenContainer = questionItem.querySelector('.children-container');
        renderQuestions(question.children, childrenContainer, level + 1);
    }

    return element;
}

function createToResolveItem(text, completed = false, id = null) {
    const li = document.createElement('li');
    li.className = 'flex items-center gap-2 text-gray-300';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'mr-2';
    checkbox.checked = completed;
    
    // Add change handler for checkbox
    if (id) {
        checkbox.addEventListener('change', async () => {
            try {
                const questionItem = li.closest('.question-item');
                const questionId = questionItem.getAttribute('data-question-id');
                await fetch(`${API_BASE}/questions/${questionId}/to-resolve/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ completed: checkbox.checked })
                });
            } catch (error) {
                console.error('Error updating to-resolve item:', error);
                checkbox.checked = !checkbox.checked; // Revert on error
            }
        });
    }
    
    const textSpan = document.createElement('span');
    textSpan.className = 'flex-1 cursor-pointer hover:text-gray-100';
    textSpan.textContent = text;
    
    // Make text editable on click
    textSpan.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = 'w-full bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-green-500';
        
        // Replace span with input
        textSpan.replaceWith(input);
        input.focus();
        
        // Handle save on blur or enter
        const saveEdit = async () => {
            const newText = input.value.trim();
            if (newText && newText !== text) {
                try {
                    const questionItem = li.closest('.question-item');
                    const questionId = questionItem.getAttribute('data-question-id');
                    const response = await fetch(`${API_BASE}/questions/${questionId}/to-resolve/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: newText })
                    });
                    const updatedItem = await response.json();
                    textSpan.textContent = updatedItem.text;
                } catch (error) {
                    console.error('Error updating to-resolve item:', error);
                    textSpan.textContent = text; // Revert on error
                }
            } else {
                textSpan.textContent = text; // Revert if no change or empty
            }
            input.replaceWith(textSpan);
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
        });
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'text-red-400 hover:text-red-300 text-xs';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = async () => {
        if (id) {
            try {
                const questionItem = li.closest('.question-item');
                const questionId = questionItem.getAttribute('data-question-id');
                await fetch(`${API_BASE}/questions/${questionId}/to-resolve/${id}`, {
                    method: 'DELETE'
                });
                li.remove();
            } catch (error) {
                console.error('Error deleting to-resolve item:', error);
            }
        } else {
            li.remove();
        }
    };
    
    li.appendChild(checkbox);
    li.appendChild(textSpan);
    li.appendChild(deleteBtn);
    return li;
}

// Handle root question submission
async function handleRootQuestionSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('rootQuestionText');
    const text = input.value.trim();
    
    if (text) {
        try {
            await fetch(`${API_BASE}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            input.value = '';
            loadQuestions();
        } catch (error) {
            console.error('Error adding question:', error);
        }
    }
}

// Show add child form
function showAddChildForm(parentId, container) {
    const form = document.createElement('form');
    form.innerHTML = `
        <div class="flex gap-2 mt-1">
            <input type="text" class="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-green-500" placeholder="Enter child question">
            <button type="submit" class="bg-gray-700 text-gray-300 px-2 py-0.5 rounded hover:bg-gray-600 text-xs">Add</button>
        </div>
    `;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        
        if (text) {
            try {
                await fetch(`${API_BASE}/questions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, parent_id: parentId })
                });
                form.remove();
                loadQuestions();
            } catch (error) {
                console.error('Error adding child question:', error);
            }
        }
    });

    container.appendChild(form);
}

// Update question
async function updateQuestion(questionId, data) {
    try {
        await fetch(`${API_BASE}/questions/${questionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Error updating question:', error);
    }
}

// Add to-resolve item
async function addToResolve(questionId, text) {
    const response = await fetch(`${API_BASE}/questions/${questionId}/to-resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    return response.json();
}

// Add or update answer
async function addAnswer(questionId, text) {
    const response = await fetch(`${API_BASE}/questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    return response.json();
}

// Export as markdown
document.getElementById('exportMarkdownBtn').addEventListener('click', async () => {
    try {
        const response = await fetch(`${API_BASE}/export/markdown`);
        const data = await response.json();
        
        // Create a temporary textarea to copy the markdown
        const textarea = document.createElement('textarea');
        textarea.value = data.markdown;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        
        // Show a temporary success message
        const btn = document.getElementById('exportMarkdownBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied to clipboard!';
        btn.classList.add('bg-green-600');
        setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('bg-green-600');
        }, 2000);
    } catch (error) {
        console.error('Error exporting markdown:', error);
        alert('Failed to export markdown. Please try again.');
    }
});

// Initial load
loadQuestions(); 