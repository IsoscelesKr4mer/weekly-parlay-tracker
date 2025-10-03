// Backup system for weekly data
var weeklyBackups = {};

// Audit log system for tracking changes
var auditLog = {};

// Manual draft system
var draftData = {};

function logAuditEntry(week, action, details, user = 'Unknown') {
    if (!auditLog[week]) {
        auditLog[week] = [];
    }
    
    var entry = {
        timestamp: new Date().toISOString(),
        user: user,
        action: action,
        details: details
    };
    
    auditLog[week].push(entry);
    
    // Keep only last 100 entries per week to prevent memory issues
    if (auditLog[week].length > 100) {
        auditLog[week] = auditLog[week].slice(-100);
    }
    
    // Save audit log to Firebase
    if (database) {
        database.ref('auditLog').set(auditLog);
    }
}

function loadAuditLogFromFirebase() {
    if (!database) return;
    
    database.ref('auditLog').on('value', function(snapshot) {
        if (snapshot.exists()) {
            auditLog = snapshot.val();
        }
    });
}

function loadBetAmountsFromFirebase() {
    if (!database) return;
    
    database.ref('betAmounts').on('value', function(snapshot) {
        if (snapshot.exists()) {
            betAmounts = snapshot.val();
        }
    });
}

function saveBetAmountsToFirebase() {
    if (!database) return;
    
    database.ref('betAmounts').set(betAmounts);
}

function loadDraftsFromFirebase() {
    if (!database) return;
    
    database.ref('drafts').on('value', function(snapshot) {
        if (snapshot.exists()) {
            var firebaseDrafts = snapshot.val();
            
            // Load existing localStorage drafts
            var savedDrafts = localStorage.getItem('parlayDrafts');
            if (savedDrafts) {
                try {
                    draftData = JSON.parse(savedDrafts);
                } catch (e) {
                    console.error('Error loading drafts from localStorage:', e);
                    draftData = {};
                }
            }
            
            // Merge Firebase drafts with localStorage drafts
            for (var weekKey in firebaseDrafts) {
                if (!draftData[weekKey]) {
                    draftData[weekKey] = {};
                }
                for (var draftName in firebaseDrafts[weekKey]) {
                    draftData[weekKey][draftName] = firebaseDrafts[weekKey][draftName];
                }
            }
            
            // Update localStorage with merged data
            localStorage.setItem('parlayDrafts', JSON.stringify(draftData));
            console.log('Drafts synced from Firebase');
        }
    });
}

function showAuditLog(week) {
    if (!auditLog[week] || auditLog[week].length === 0) {
        showNotification('No audit entries found for Week ' + week, 'info');
        return;
    }
    
    var logHtml = '<div class="audit-log-modal">';
    logHtml += '<h3>📋 Audit Log - Week ' + week + '</h3>';
    logHtml += '<div class="audit-entries">';
    
    // Show entries in reverse chronological order (newest first)
    auditLog[week].slice().reverse().forEach(function(entry) {
        var date = new Date(entry.timestamp).toLocaleString();
        logHtml += '<div class="audit-entry">';
        logHtml += '<div class="audit-header">';
        logHtml += '<span class="audit-time">' + date + '</span>';
        logHtml += '<span class="audit-user">' + entry.user + '</span>';
        logHtml += '</div>';
        logHtml += '<div class="audit-action">' + entry.action + '</div>';
        if (entry.details) {
            logHtml += '<div class="audit-details">' + entry.details + '</div>';
        }
        logHtml += '</div>';
    });
    
    logHtml += '</div>';
    logHtml += '<button class="btn" onclick="closeModal()" style="background: #6b7280; margin-top: 20px;">Close</button>';
    logHtml += '</div>';
    
    showModal(logHtml);
}

// Manual draft functions
function saveDraft(week) {
    // Prompt for draft name
    var draftName = prompt('Enter a name for this draft:');
    if (!draftName || draftName.trim() === '') {
        showNotification('Draft name is required', 'error');
        return;
    }
    
    // Load existing drafts from localStorage
    var savedDrafts = localStorage.getItem('parlayDrafts');
    if (savedDrafts) {
        try {
            draftData = JSON.parse(savedDrafts);
        } catch (e) {
            console.error('Error loading drafts:', e);
            draftData = {};
        }
    }
    
    if (!draftData[week]) {
        draftData[week] = {};
    }
    
    var pickSlots = document.querySelectorAll('.pick-slot');
    var hasData = false;
    
    // First, save any unsaved form data
    pickSlots.forEach(function(slot, index) {
        var playerInput = slot.querySelector('input[placeholder*="Player"]');
        var pickInput = slot.querySelector('input[placeholder*="Pick"]');
        var oddsInput = slot.querySelector('input[placeholder*="Odds"]');
        var gameSelect = slot.querySelector('select');
        var timeSlotSelect = slot.querySelector('select[name*="timeSlot"]');
        
        // Only save if at least one field has content
        if ((playerInput && playerInput.value.trim()) || 
            (pickInput && pickInput.value.trim()) || 
            (oddsInput && oddsInput.value.trim())) {
            
            draftData[week][index] = {
                playerName: playerInput ? playerInput.value.trim() : '',
                pick: pickInput ? pickInput.value.trim() : '',
                odds: oddsInput ? oddsInput.value.trim() : '',
                game: gameSelect ? gameSelect.value : '',
                timeSlot: timeSlotSelect ? timeSlotSelect.value : '',
                timestamp: Date.now()
            };
            hasData = true;
        }
    });
    
    // Also save completed picks from weeklyPicks data
    var savedPicks = weeklyPicks[week] || [];
    savedPicks.forEach(function(pick, index) {
        if (pick) {
            draftData[week][index] = {
                playerName: pick.playerName || '',
                pick: pick.pick || '',
                odds: pick.odds || '',
                game: pick.game || '',
                timeSlot: pick.timeSlot || '',
                result: pick.result || null,
                isSGP: pick.isSGP || false,
                sgpOdds: pick.sgpOdds || null,
                timestamp: Date.now()
            };
            hasData = true;
        }
    });
    
    if (hasData) {
        // Create a copy of the current draft data
        var draftPicks = {};
        Object.keys(draftData[week]).forEach(function(key) {
            if (typeof draftData[week][key] === 'object' && draftData[week][key].playerName !== undefined) {
                draftPicks[key] = draftData[week][key];
            }
        });
        
        // Save to localStorage with draft name
        draftData[week][draftName] = {
            picks: draftPicks,
            timestamp: Date.now()
        };
        
        // Remove the old unnamed data
        Object.keys(draftData[week]).forEach(function(key) {
            if (key !== draftName && typeof draftData[week][key] === 'object' && !draftData[week][key].picks) {
                delete draftData[week][key];
            }
        });
        
        localStorage.setItem('parlayDrafts', JSON.stringify(draftData));
        
        // Also save to Firebase
        if (database) {
            database.ref('drafts').set(draftData);
        }
        
        showNotification('Draft "' + draftName + '" saved for Week ' + week, 'success');
    } else {
        showNotification('No data to save as draft', 'info');
    }
}

function viewDrafts(week) {
    // Load from localStorage first
    var savedDrafts = localStorage.getItem('parlayDrafts');
    if (savedDrafts) {
        try {
            draftData = JSON.parse(savedDrafts);
        } catch (e) {
            console.error('Error loading drafts from localStorage:', e);
            draftData = {};
        }
    }
    
    // Also load from Firebase
    if (database) {
        database.ref('drafts').once('value', function(snapshot) {
            if (snapshot.exists()) {
                var firebaseDrafts = snapshot.val();
                // Merge Firebase drafts with localStorage drafts
                for (var weekKey in firebaseDrafts) {
                    if (!draftData[weekKey]) {
                        draftData[weekKey] = {};
                    }
                    for (var draftName in firebaseDrafts[weekKey]) {
                        draftData[weekKey][draftName] = firebaseDrafts[weekKey][draftName];
                    }
                }
                // Update localStorage with merged data
                localStorage.setItem('parlayDrafts', JSON.stringify(draftData));
            }
        });
    }
    
    var weekDrafts = draftData[week];
    if (!weekDrafts || Object.keys(weekDrafts).length === 0) {
        showNotification('No drafts found for Week ' + week, 'info');
        return;
    }
    
    // Show draft management modal
    showDraftManagementModal(week, weekDrafts);
}

function showDraftManagementModal(week, weekDrafts) {
    var html = '<div class="draft-management-modal">';
    html += '<h3>📂 Draft Manager - Week ' + week + '</h3>';
    html += '<p>Manage your saved drafts:</p>';
    html += '<div class="draft-list">';
    
    Object.keys(weekDrafts).forEach(function(draftName) {
        var draft = weekDrafts[draftName];
        if (draft && draft.picks) {
            var date = new Date(draft.timestamp).toLocaleString();
            var pickCount = Object.keys(draft.picks).length;
            html += '<div class="draft-item">';
            html += '<div class="draft-info">';
            html += '<strong>' + draftName + '</strong>';
            html += '<div class="draft-time">Saved: ' + date + '</div>';
            html += '<div class="draft-count">' + pickCount + ' pick(s)</div>';
            html += '</div>';
            html += '<div class="draft-actions">';
            html += '<button class="btn" onclick="loadSelectedDraft(' + week + ', \'' + draftName + '\'); closeModal();" style="background: #10b981; padding: 8px 12px; font-size: 12px; margin-right: 8px;">Load</button>';
            html += '<button class="btn" onclick="deleteDraft(' + week + ', \'' + draftName + '\'); showDraftManagementModal(' + week + ', draftData[' + week + ']);" style="background: #ef4444; padding: 8px 12px; font-size: 12px;">Delete</button>';
            html += '</div>';
            html += '</div>';
        }
    });
    
    html += '</div>';
    html += '<button class="btn" onclick="closeModal()" style="background: #6b7280; margin-top: 20px;">Close</button>';
    html += '</div>';
    
    showModal(html);
}

function loadSelectedDraft(week, draftName) {
    var weekDrafts = draftData[week];
    var selectedDraft = weekDrafts[draftName];
    
    if (!selectedDraft || !selectedDraft.picks) {
        showNotification('Draft not found', 'error');
        return;
    }
    
    var draftPicks = selectedDraft.picks;
    
    // Load the draft data into the form
    var pickSlots = document.querySelectorAll('.pick-slot');
    var loadedCount = 0;
    
    pickSlots.forEach(function(slot, index) {
        var draft = draftPicks[index];
        if (draft) {
            var playerInput = slot.querySelector('input[placeholder*="Player"]');
            var pickInput = slot.querySelector('input[placeholder*="Pick"]');
            var oddsInput = slot.querySelector('input[placeholder*="Odds"]');
            var gameSelect = slot.querySelector('select');
            var timeSlotSelect = slot.querySelector('select[name*="timeSlot"]');
            
            if (playerInput && draft.playerName) playerInput.value = draft.playerName;
            if (pickInput && draft.pick) pickInput.value = draft.pick;
            if (oddsInput && draft.odds) oddsInput.value = draft.odds;
            if (gameSelect && draft.game) gameSelect.value = draft.game;
            if (timeSlotSelect && draft.timeSlot) timeSlotSelect.value = draft.timeSlot;
            loadedCount++;
        }
    });
    
    // Also load completed picks back into weeklyPicks data
    var restoredPicks = [];
    Object.keys(draftPicks).forEach(function(index) {
        var draft = draftPicks[index];
        if (draft && (draft.playerName || draft.pick || draft.odds)) {
            restoredPicks[parseInt(index)] = {
                playerName: draft.playerName || '',
                pick: draft.pick || '',
                odds: draft.odds || '',
                game: draft.game || '',
                timeSlot: draft.timeSlot || '',
                result: draft.result || null,
                isSGP: draft.isSGP || false,
                sgpOdds: draft.sgpOdds || null,
                timestamp: Date.now()
            };
        }
    });
    
    if (restoredPicks.length > 0) {
        weeklyPicks[week] = restoredPicks;
        saveToFirebase();
        renderAllPicks();
        updateCalculations();
        updateParlayStatus();
    }
    
    if (loadedCount > 0 || restoredPicks.length > 0) {
        showNotification('Loaded draft "' + draftName + '" for Week ' + week, 'success');
    } else {
        showNotification('No valid drafts to load', 'info');
    }
}

function deleteDraft(week, draftName) {
    if (!confirm('Are you sure you want to delete the draft "' + draftName + '" for Week ' + week + '?\n\nThis action cannot be undone.')) {
        return;
    }
    
    if (draftData[week] && draftData[week][draftName]) {
        delete draftData[week][draftName];
        
        // Update localStorage
        localStorage.setItem('parlayDrafts', JSON.stringify(draftData));
        
        // Update Firebase
        if (database) {
            database.ref('drafts').set(draftData);
        }
        
        showNotification('Draft "' + draftName + '" deleted for Week ' + week, 'success');
    } else {
        showNotification('Draft not found', 'error');
    }
}

// Debug function to check Week 4 data
function debugWeek4Data() {
    console.log('=== WEEK 4 DEBUG ===');
    var week4Picks = weeklyPicks[4] || [];
    console.log('Total picks:', week4Picks.length);
    
    week4Picks.forEach(function(pick, index) {
        if (pick) {
            console.log('Pick ' + index + ':', {
                playerName: pick.playerName,
                pick: pick.pick,
                odds: pick.odds,
                game: pick.game,
                isSGP: pick.isSGP,
                sgpOdds: pick.sgpOdds,
                result: pick.result
            });
        }
    });
    
    // Test both calculation methods
    var activePicks = week4Picks.filter(function(p) { 
    return p && p.result !== 'draw' && p.pick && p.pick !== 'TBD' && p.pick !== '' && p.odds && p.odds !== 'TBD' && p.odds !== ''; 
});
    console.log('Active picks:', activePicks.length);
    
    // Method 1: updateBetCalculations logic
    var totalOdds1 = 1;
    var gameGroups1 = {};
    var processedGames1 = {};
    
    activePicks.forEach(function(pick) {
        if (pick.game && pick.game !== 'No game') {
            if (!gameGroups1[pick.game]) {
                gameGroups1[pick.game] = [];
            }
            gameGroups1[pick.game].push(pick);
        }
    });
    
    activePicks.forEach(function(pick) {
        var activeLegsForGame = gameGroups1[pick.game] ? gameGroups1[pick.game].length : 1;
        
        if (pick.isSGP && activeLegsForGame === 1) {
            totalOdds1 *= americanToDecimal(pick.odds);
        } else if (pick.isSGP && pick.sgpOdds && activeLegsForGame >= 2) {
            if (!processedGames1[pick.game]) {
                processedGames1[pick.game] = true;
                totalOdds1 *= americanToDecimal(pick.sgpOdds);
            }
        } else if (!pick.isSGP) {
            totalOdds1 *= americanToDecimal(pick.odds);
        }
    });
    
    // Method 2: updateCalculations logic
    var totalOdds2 = 1;
    var gamePickCounts2 = {};
    var processedGames2 = {};
    
    activePicks.forEach(function(pick) {
        if (pick.game && pick.game !== 'No game') {
            gamePickCounts2[pick.game] = (gamePickCounts2[pick.game] || 0) + 1;
        }
    });
    
    activePicks.forEach(function(pick) {
        var activeLegsForGame = pick.game ? gamePickCounts2[pick.game] : 0;
        
        if (pick.isSGP && activeLegsForGame === 1) {
            totalOdds2 *= americanToDecimal(pick.odds);
        } else if (pick.isSGP && pick.sgpOdds && activeLegsForGame >= 2) {
            if (!processedGames2[pick.game]) {
                processedGames2[pick.game] = true;
                totalOdds2 *= americanToDecimal(pick.sgpOdds);
            }
        } else if (!pick.isSGP) {
            totalOdds2 *= americanToDecimal(pick.odds);
        }
    });
    
    console.log('Method 1 (updateBetCalculations):', decimalToAmerican(totalOdds1));
    console.log('Method 2 (updateCalculations):', decimalToAmerican(totalOdds2));
    console.log('Game groups (Method 1):', gameGroups1);
    console.log('Game counts (Method 2):', gamePickCounts2);
    
    // Detailed SGP analysis
    console.log('\n=== SGP DETAILED ANALYSIS ===');
    Object.keys(gameGroups1).forEach(function(game) {
        var picks = gameGroups1[game];
        if (picks.length > 1) {
            console.log('Game:', game);
            console.log('  Picks count:', picks.length);
            picks.forEach(function(pick, index) {
                console.log('  Pick ' + index + ':', {
                    playerName: pick.playerName,
                    pick: pick.pick,
                    odds: pick.odds,
                    isSGP: pick.isSGP,
                    sgpOdds: pick.sgpOdds,
                    result: pick.result
                });
            });
            
            // Check if all picks have the same SGP odds
            var sgpOdds = picks[0].sgpOdds;
            var allSameSgpOdds = picks.every(function(pick) {
                return pick.sgpOdds === sgpOdds;
            });
            console.log('  All have same SGP odds:', allSameSgpOdds, 'SGP odds:', sgpOdds);
        }
    });
    
    console.log('==================');
}

// Fix SGP data inconsistencies
function fixSGPData(week) {
    if (!weeklyPicks[week]) {
        showNotification('No data found for Week ' + week, 'error');
        return;
    }
    
    var fixed = false;
    var gameGroups = {};
    
    // Group picks by game
    weeklyPicks[week].forEach(function(pick, index) {
        if (pick && pick.game && pick.game !== 'TBD' && pick.pick && pick.pick !== 'TBD' && pick.pick !== '' && pick.odds && pick.odds !== 'TBD' && pick.odds !== '') {
            if (!gameGroups[pick.game]) {
                gameGroups[pick.game] = [];
            }
            gameGroups[pick.game].push({pick: pick, index: index});
        }
    });
    
    // Fix SGP inconsistencies
    Object.keys(gameGroups).forEach(function(game) {
        var picks = gameGroups[game];
        if (picks.length > 1) {
            // Find the SGP odds to use (from the first pick that has them)
            var sgpOdds = null;
            var hasSGP = false;
            
            picks.forEach(function(item) {
                if (item.pick.isSGP && item.pick.sgpOdds) {
                    sgpOdds = item.pick.sgpOdds;
                    hasSGP = true;
                }
            });
            
            if (hasSGP && sgpOdds) {
                // Apply SGP odds to all picks in this game
                picks.forEach(function(item) {
                    if (!item.pick.isSGP || !item.pick.sgpOdds) {
                        item.pick.isSGP = true;
                        item.pick.sgpOdds = sgpOdds;
                        fixed = true;
                        console.log('Fixed pick:', item.pick.playerName, 'in game:', game, 'with SGP odds:', sgpOdds);
                    }
                });
            }
        }
    });
    
    if (fixed) {
        saveToFirebase();
        showNotification('SGP data fixed for Week ' + week + '! Odds recalculated.', 'success');
        updateCalculations();
        renderAllPicks();
    } else {
        showNotification('No SGP inconsistencies found in Week ' + week, 'info');
    }
}

function recalculateOdds(week) {
    if (!weeklyPicks[week]) {
        showNotification('No data found for Week ' + week, 'error');
        return;
    }
    
    console.log('Recalculating odds for Week', week);
    
    // Reset all SGP flags and odds
    weeklyPicks[week].forEach(function(pick) {
        if (pick) {
            pick.isSGP = false;
            pick.sgpOdds = null;
        }
    });
    
    // Save the reset data
    saveToFirebase();
    
    // Re-run SGP detection
    checkForSGPs();
    
    // Recalculate all odds
    updateCalculations();
    updateParlayStatus();
    
    // Re-render to show updated data
    renderAllPicks();
    
    showNotification('✓ Odds recalculated successfully!', 'success');
    console.log('Odds recalculation completed for Week', week);
}

// Admin dropdown functions
function toggleAdminDropdown() {
    var menu = document.getElementById('adminMenu');
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

function hideAdminDropdown() {
    var menu = document.getElementById('adminMenu');
    menu.style.display = 'none';
}

// Close admin dropdown when clicking outside
document.addEventListener('click', function(event) {
    var adminDropdown = document.querySelector('.admin-dropdown');
    var adminMenu = document.getElementById('adminMenu');
    
    if (adminDropdown && !adminDropdown.contains(event.target)) {
        adminMenu.style.display = 'none';
    }
});

// Modal functions
function showModal(html) {
    // Remove existing modal if any
    var existingModal = document.getElementById('modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal overlay
    var modal = document.createElement('div');
    modal.id = 'modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    // Create modal content
    var modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 90vw;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `;
    modalContent.innerHTML = html;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal when clicking overlay
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

// Preserve unsaved form data
var unsavedFormData = {};

function preserveUnsavedFormData() {
    // Clear previous data
    unsavedFormData = {};
    
    // Get all pick slots
    var pickSlots = document.querySelectorAll('.pick-slot');
    pickSlots.forEach(function(slot, index) {
        var playerInput = slot.querySelector('input[placeholder*="Player"]');
        var pickInput = slot.querySelector('input[placeholder*="Pick"]');
        var oddsInput = slot.querySelector('input[placeholder*="Odds"]');
        var gameSelect = slot.querySelector('select');
        var timeSlotSelect = slot.querySelector('select[name*="timeSlot"]');
        
        // Only preserve if there's actual data and it's not saved
        var hasData = false;
        var data = {};
        
        if (playerInput && playerInput.value.trim()) {
            data.playerName = playerInput.value.trim();
            hasData = true;
        }
        if (pickInput && pickInput.value.trim()) {
            data.pick = pickInput.value.trim();
            hasData = true;
        }
        if (oddsInput && oddsInput.value.trim()) {
            data.odds = oddsInput.value.trim();
            hasData = true;
        }
        if (gameSelect && gameSelect.value) {
            data.game = gameSelect.value;
            hasData = true;
        }
        if (timeSlotSelect && timeSlotSelect.value) {
            data.timeSlot = timeSlotSelect.value;
            hasData = true;
        }
        
        // Only preserve if there's data and this slot doesn't have a saved pick
        if (hasData && !weeklyPicks[currentWeek][index]) {
            unsavedFormData[index] = data;
        }
    });
}

function restoreUnsavedFormData() {
    // Restore unsaved form data after re-rendering
    for (var index in unsavedFormData) {
        var data = unsavedFormData[index];
        var playerInput = document.getElementById('playerName' + index);
        var pickInput = document.getElementById('pick' + index);
        var oddsInput = document.getElementById('odds' + index);
        var gameSelect = document.getElementById('game' + index);
        var timeSlotSelect = document.getElementById('timeSlot' + index);
        
        if (playerInput && data.playerName) playerInput.value = data.playerName;
        if (pickInput && data.pick) pickInput.value = data.pick;
        if (oddsInput && data.odds) oddsInput.value = data.odds;
        if (gameSelect && data.game) gameSelect.value = data.game;
        if (timeSlotSelect && data.timeSlot) timeSlotSelect.value = data.timeSlot;
    }
}

function closeModal() {
    var modal = document.getElementById('modal');
    if (modal) {
        modal.remove();
    }
}

function createBackup(week) {
    if (weeklyPicks[week]) {
        weeklyBackups[week] = {
            data: JSON.parse(JSON.stringify(weeklyPicks[week])),
            timestamp: new Date().toISOString(),
            betAmount: betAmounts[week] || 24
        };
        console.log('Backup created for Week ' + week);
    }
}

function restoreBackup(week) {
    if (weeklyBackups[week]) {
        if (confirm('🔄 Restore Week ' + week + ' from backup?\n\nBackup created: ' + new Date(weeklyBackups[week].timestamp).toLocaleString() + '\n\nThis will overwrite current data.')) {
            weeklyPicks[week] = JSON.parse(JSON.stringify(weeklyBackups[week].data));
            betAmounts[week] = weeklyBackups[week].betAmount;
            saveToFirebase();
            saveBetAmountsToFirebase();
            renderAllPicks();
            updateCalculations();
            updateParlayStatus();
            showNotification('Week ' + week + ' restored from backup!', 'success');
        }
    } else {
        showNotification('No backup available for Week ' + week, 'error');
    }
}


// Auto-create backup before destructive actions
function createBackupBeforeAction(week) {
    createBackup(week);
}

// Utility function to format numbers with commas
function formatNumber(num) {
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Utility function to format currency with commas
function formatCurrency(num) {
    return '$' + num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

var weeklyPicks = {};
var leaderboardData = {};
var isSavingToFirebase = false; // Flag to prevent Firebase listener from overriding our saves
var betAmounts = {}; // Store bet amounts per week
var lockedWeeks = {}; // Track which weeks are locked
var lockPassword = "BigDumperis110%sexy"; // Password to unlock picks

// Google Sheets sync configuration
var sheetsConfig = {
    spreadsheetId: '', // Will be set by user
    currentWeekGid: '', // GID for the "CURRENT WEEK" sheet
    weekGids: {}, // Store GIDs for each week (Week 1, Week 2, etc.)
    syncInterval: null, // Store interval ID for auto-sync
    autoSyncEnabled: false
};

// Team abbreviation mapping for Google Sheets sync
var teamAbbreviations = {
    'ARI': 'Arizona Cardinals',
    'ATL': 'Atlanta Falcons',
    'BAL': 'Baltimore Ravens',
    'BUF': 'Buffalo Bills',
    'CAR': 'Carolina Panthers',
    'CHI': 'Chicago Bears',
    'CIN': 'Cincinnati Bengals',
    'CLE': 'Cleveland Browns',
    'DAL': 'Dallas Cowboys',
    'DEN': 'Denver Broncos',
    'DET': 'Detroit Lions',
    'GB': 'Green Bay Packers',
    'HOU': 'Houston Texans',
    'IND': 'Indianapolis Colts',
    'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs',
    'LV': 'Las Vegas Raiders',
    'LAC': 'Los Angeles Chargers',
    'LAR': 'Los Angeles Rams',
    'MIA': 'Miami Dolphins',
    'MIN': 'Minnesota Vikings',
    'NE': 'New England Patriots',
    'NO': 'New Orleans Saints',
    'NYG': 'New York Giants',
    'NYJ': 'New York Jets',
    'PHI': 'Philadelphia Eagles',
    'PIT': 'Pittsburgh Steelers',
    'SF': 'San Francisco 49ers',
    'SEA': 'Seattle Seahawks',
    'TB': 'Tampa Bay Buccaneers',
    'TEN': 'Tennessee Titans',
    'WAS': 'Washington Commanders'
};
function getCurrentNFLWeek() {
    // 2025 NFL Season started September 4, 2025 (Week 1) at 8:20 PM EST
    // NFL weeks run Tuesday to Monday
    // Week 1: Thu Sep 4 - Mon Sep 15
    // Week 2: Tue Sep 16 - Mon Sep 22
    // Week 3: Tue Sep 23 - Mon Sep 29
    // Week 4: Tue Sep 30 - Mon Oct 6 (THIS IS WEEK 5, not Week 4!)
    
    // First Tuesday after season start marks the transition to Week 2
    // Sep 4 (Thu) -> Sep 9 (Tue) is the first Tuesday
    var firstTuesday = new Date('2025-09-09T00:00:00-05:00');
    
    // Get current time in Eastern Time
    var now = new Date();
    var easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    // Week 1 runs from Sep 4 (Thu) to Sep 8 (Mon)
    if (easternTime < firstTuesday) {
        return 1;
    }
    
    // Calculate weeks since first Tuesday
    var daysSinceFirstTuesday = Math.floor((easternTime - firstTuesday) / (1000 * 60 * 60 * 24));
    var weeksSinceFirstTuesday = Math.floor(daysSinceFirstTuesday / 7);
    var calculatedWeek = 2 + weeksSinceFirstTuesday;
    
    // Ensure we don't go beyond Week 18
    return Math.min(Math.max(calculatedWeek, 1), 18);
}

function updateCurrentWeekDropdown() {
var currentNFLWeek = getCurrentNFLWeek();
var mainSelect = document.getElementById('currentWeek');
var summarySelect = document.getElementById('summaryWeekSelect');

// Update main dropdown
if (mainSelect) {
// Clear existing "(Current Week)" labels
for (var i = 0; i < mainSelect.options.length; i++) {
var option = mainSelect.options[i];
option.text = option.text.replace(' (Current Week)', '');
}

// Add "(Current Week)" to the current week
var currentOption = mainSelect.options[currentNFLWeek - 1];
if (currentOption) {
currentOption.text += ' (Current Week)';
currentOption.selected = true;
}
}

// Update summary dropdown
if (summarySelect) {
// Clear existing "(Current Week)" labels
for (var i = 0; i < summarySelect.options.length; i++) {
var option = summarySelect.options[i];
option.text = option.text.replace(' (Current Week)', '');
}

// Add "(Current Week)" to the current week
var currentSummaryOption = summarySelect.options[currentNFLWeek - 1];
if (currentSummaryOption) {
currentSummaryOption.text += ' (Current Week)';
currentSummaryOption.selected = true;
}
}

return currentNFLWeek;
}
var nflSchedule = {};
var database = null;

var playerNames = [
'Jace Allison',
'Khaled Daher',
'Michael Dixon',
'Michael Hedges',
'Elliott Kalin',
'Brendan McAleer',
'Nehad Osman',
'Nick Rose',
'Mario Sanelli',
'Tyler Vander Boegh',
'Jared Warren',
'Taylor Young'
];

var firebaseConfig = {
apiKey: "AIzaSyCSen1b1IDNvRXg96CZXf9PTGURvCga3Cs",
authDomain: "parlay-picker.firebaseapp.com",
databaseURL: "https://parlay-picker-default-rtdb.firebaseio.com/",
projectId: "parlay-picker",
storageBucket: "parlay-picker.firebasestorage.app",
messagingSenderId: "1086482831557",
appId: "1:1086482831557:web:16e5f542a0d48e0dc538ac",
measurementId: "G-E7F4G8DEN8"
};

var nfl2025Schedule = {
1: [
{ matchup: 'Dallas Cowboys @ Philadelphia Eagles', time: 'TNF' },
{ matchup: 'Kansas City Chiefs @ Los Angeles Chargers', time: 'Early' },
{ matchup: 'Las Vegas Raiders @ New England Patriots', time: 'Early' },
{ matchup: 'Pittsburgh Steelers @ New York Jets', time: 'Early' },
{ matchup: 'Miami Dolphins @ Indianapolis Colts', time: 'Early' },
{ matchup: 'Arizona Cardinals @ New Orleans Saints', time: 'Early' },
{ matchup: 'New York Giants @ Washington Commanders', time: 'Early' },
{ matchup: 'Carolina Panthers @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'Cincinnati Bengals @ Cleveland Browns', time: 'Early' },
{ matchup: 'Tampa Bay Buccaneers @ Atlanta Falcons', time: 'Early' },
{ matchup: 'Tennessee Titans @ Denver Broncos', time: 'Late' },
{ matchup: 'San Francisco 49ers @ Seattle Seahawks', time: 'Late' },
{ matchup: 'Detroit Lions @ Green Bay Packers', time: 'Late' },
{ matchup: 'Houston Texans @ Los Angeles Rams', time: 'Late' },
{ matchup: 'Baltimore Ravens @ Buffalo Bills', time: 'SNF' },
{ matchup: 'Minnesota Vikings @ Chicago Bears', time: 'MNF' }
],
2: [
{ matchup: 'Washington Commanders @ Green Bay Packers', time: 'TNF' },
{ matchup: 'Jacksonville Jaguars @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Buffalo Bills @ New York Jets', time: 'Early' },
{ matchup: 'New England Patriots @ Miami Dolphins', time: 'Early' },
{ matchup: 'Los Angeles Rams @ Tennessee Titans', time: 'Early' },
{ matchup: 'Cleveland Browns @ Baltimore Ravens', time: 'Early' },
{ matchup: 'San Francisco 49ers @ New Orleans Saints', time: 'Early' },
{ matchup: 'New York Giants @ Dallas Cowboys', time: 'Early' },
{ matchup: 'Seattle Seahawks @ Pittsburgh Steelers', time: 'Early' },
{ matchup: 'Chicago Bears @ Detroit Lions', time: 'Early' },
{ matchup: 'Denver Broncos @ Indianapolis Colts', time: 'Late' },
{ matchup: 'Carolina Panthers @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Philadelphia Eagles @ Kansas City Chiefs', time: 'Late' },
{ matchup: 'Atlanta Falcons @ Minnesota Vikings', time: 'SNF' },
{ matchup: 'Tampa Bay Buccaneers @ Houston Texans', time: 'MNF' },
{ matchup: 'Los Angeles Chargers @ Las Vegas Raiders', time: 'MNF' }
],
3: [
{ matchup: 'Miami Dolphins @ Buffalo Bills', time: 'TNF' },
{ matchup: 'Pittsburgh Steelers @ New England Patriots', time: 'Early' },
{ matchup: 'Houston Texans @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'Indianapolis Colts @ Tennessee Titans', time: 'Early' },
{ matchup: 'Cincinnati Bengals @ Minnesota Vikings', time: 'Early' },
{ matchup: 'New York Jets @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'Green Bay Packers @ Cleveland Browns', time: 'Early' },
{ matchup: 'Las Vegas Raiders @ Washington Commanders', time: 'Early' },
{ matchup: 'Atlanta Falcons @ Carolina Panthers', time: 'Early' },
{ matchup: 'Los Angeles Rams @ Philadelphia Eagles', time: 'Early' },
{ matchup: 'New Orleans Saints @ Seattle Seahawks', time: 'Late' },
{ matchup: 'Denver Broncos @ Los Angeles Chargers', time: 'Late' },
{ matchup: 'Dallas Cowboys @ Chicago Bears', time: 'Late' },
{ matchup: 'Arizona Cardinals @ San Francisco 49ers', time: 'Late' },
{ matchup: 'Kansas City Chiefs @ New York Giants', time: 'SNF' },
{ matchup: 'Detroit Lions @ Baltimore Ravens', time: 'MNF' }
],
4: [
{ matchup: 'Seattle Seahawks @ Arizona Cardinals', time: 'TNF' },
{ matchup: 'Minnesota Vikings @ Pittsburgh Steelers', time: 'Early' },
{ matchup: 'New Orleans Saints @ Buffalo Bills', time: 'Early' },
{ matchup: 'Washington Commanders @ Atlanta Falcons', time: 'Early' },
{ matchup: 'Los Angeles Chargers @ New York Giants', time: 'Early' },
{ matchup: 'Tennessee Titans @ Houston Texans', time: 'Early' },
{ matchup: 'Cleveland Browns @ Detroit Lions', time: 'Early' },
{ matchup: 'Carolina Panthers @ New England Patriots', time: 'Early' },
{ matchup: 'Philadelphia Eagles @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'Jacksonville Jaguars @ San Francisco 49ers', time: 'Late' },
{ matchup: 'Indianapolis Colts @ Los Angeles Rams', time: 'Late' },
{ matchup: 'Baltimore Ravens @ Kansas City Chiefs', time: 'Late' },
{ matchup: 'Chicago Bears @ Las Vegas Raiders', time: 'Late' },
{ matchup: 'Green Bay Packers @ Dallas Cowboys', time: 'SNF' },
{ matchup: 'New York Jets @ Miami Dolphins', time: 'MNF' },
{ matchup: 'Cincinnati Bengals @ Denver Broncos', time: 'MNF' }
],
5: [
{ matchup: 'San Francisco 49ers @ Los Angeles Rams', time: 'TNF' },
{ matchup: 'Minnesota Vikings @ Cleveland Browns', time: 'Early' },
{ matchup: 'New York Giants @ New Orleans Saints', time: 'Early' },
{ matchup: 'Denver Broncos @ Philadelphia Eagles', time: 'Early' },
{ matchup: 'Houston Texans @ Baltimore Ravens', time: 'Early' },
{ matchup: 'Dallas Cowboys @ New York Jets', time: 'Early' },
{ matchup: 'Las Vegas Raiders @ Indianapolis Colts', time: 'Early' },
{ matchup: 'Miami Dolphins @ Carolina Panthers', time: 'Early' },
{ matchup: 'Tennessee Titans @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Tampa Bay Buccaneers @ Seattle Seahawks', time: 'Late' },
{ matchup: 'Washington Commanders @ Los Angeles Chargers', time: 'Late' },
{ matchup: 'Detroit Lions @ Cincinnati Bengals', time: 'Late' },
{ matchup: 'New England Patriots @ Buffalo Bills', time: 'SNF' },
{ matchup: 'Kansas City Chiefs @ Jacksonville Jaguars', time: 'MNF' }
],
6: [
{ matchup: 'Philadelphia Eagles @ New York Giants', time: 'TNF' },
{ matchup: 'Denver Broncos @ New York Jets', time: 'Early' },
{ matchup: 'Cleveland Browns @ Pittsburgh Steelers', time: 'Early' },
{ matchup: 'Los Angeles Chargers @ Miami Dolphins', time: 'Early' },
{ matchup: 'San Francisco 49ers @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'Seattle Seahawks @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'Dallas Cowboys @ Carolina Panthers', time: 'Early' },
{ matchup: 'Los Angeles Rams @ Baltimore Ravens', time: 'Early' },
{ matchup: 'Arizona Cardinals @ Indianapolis Colts', time: 'Early' },
{ matchup: 'Tennessee Titans @ Las Vegas Raiders', time: 'Late' },
{ matchup: 'Cincinnati Bengals @ Green Bay Packers', time: 'Late' },
{ matchup: 'New England Patriots @ New Orleans Saints', time: 'Late' },
{ matchup: 'Detroit Lions @ Kansas City Chiefs', time: 'SNF' },
{ matchup: 'Chicago Bears @ Washington Commanders', time: 'MNF' },
{ matchup: 'Buffalo Bills @ Atlanta Falcons', time: 'MNF' }
],
7: [
{ matchup: 'Pittsburgh Steelers @ Cincinnati Bengals', time: 'TNF' },
{ matchup: 'Los Angeles Rams @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'New England Patriots @ Tennessee Titans', time: 'Early' },
{ matchup: 'Miami Dolphins @ Cleveland Browns', time: 'Early' },
{ matchup: 'Las Vegas Raiders @ Kansas City Chiefs', time: 'Early' },
{ matchup: 'Carolina Panthers @ New York Jets', time: 'Early' },
{ matchup: 'New Orleans Saints @ Chicago Bears', time: 'Early' },
{ matchup: 'Philadelphia Eagles @ Minnesota Vikings', time: 'Early' },
{ matchup: 'New York Giants @ Denver Broncos', time: 'Late' },
{ matchup: 'Indianapolis Colts @ Los Angeles Chargers', time: 'Late' },
{ matchup: 'Washington Commanders @ Dallas Cowboys', time: 'Late' },
{ matchup: 'Green Bay Packers @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Atlanta Falcons @ San Francisco 49ers', time: 'SNF' },
{ matchup: 'Tampa Bay Buccaneers @ Detroit Lions', time: 'MNF' },
{ matchup: 'Houston Texans @ Seattle Seahawks', time: 'MNF' }
],
8: [
{ matchup: 'Minnesota Vikings @ Los Angeles Chargers', time: 'TNF' },
{ matchup: 'New York Jets @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Chicago Bears @ Baltimore Ravens', time: 'Early' },
{ matchup: 'Miami Dolphins @ Atlanta Falcons', time: 'Early' },
{ matchup: 'Cleveland Browns @ New England Patriots', time: 'Early' },
{ matchup: 'New York Giants @ Philadelphia Eagles', time: 'Early' },
{ matchup: 'Buffalo Bills @ Carolina Panthers', time: 'Early' },
{ matchup: 'San Francisco 49ers @ Houston Texans', time: 'Early' },
{ matchup: 'Tampa Bay Buccaneers @ New Orleans Saints', time: 'Late' },
{ matchup: 'Dallas Cowboys @ Denver Broncos', time: 'Late' },
{ matchup: 'Tennessee Titans @ Indianapolis Colts', time: 'Late' },
{ matchup: 'Green Bay Packers @ Pittsburgh Steelers', time: 'SNF' },
{ matchup: 'Washington Commanders @ Kansas City Chiefs', time: 'MNF' }
],
9: [
{ matchup: 'Baltimore Ravens @ Miami Dolphins', time: 'TNF' },
{ matchup: 'Indianapolis Colts @ Pittsburgh Steelers', time: 'Early' },
{ matchup: 'Atlanta Falcons @ New England Patriots', time: 'Early' },
{ matchup: 'Chicago Bears @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Los Angeles Chargers @ Tennessee Titans', time: 'Early' },
{ matchup: 'San Francisco 49ers @ New York Giants', time: 'Early' },
{ matchup: 'Carolina Panthers @ Green Bay Packers', time: 'Early' },
{ matchup: 'Denver Broncos @ Houston Texans', time: 'Early' },
{ matchup: 'Minnesota Vikings @ Detroit Lions', time: 'Early' },
{ matchup: 'Jacksonville Jaguars @ Las Vegas Raiders', time: 'Late' },
{ matchup: 'New Orleans Saints @ Los Angeles Rams', time: 'Late' },
{ matchup: 'Kansas City Chiefs @ Buffalo Bills', time: 'Late' },
{ matchup: 'Seattle Seahawks @ Washington Commanders', time: 'SNF' },
{ matchup: 'Arizona Cardinals @ Dallas Cowboys', time: 'MNF' }
],
10: [
{ matchup: 'Las Vegas Raiders @ Denver Broncos', time: 'TNF' },
{ matchup: 'Atlanta Falcons @ Indianapolis Colts', time: 'Early' },
{ matchup: 'Jacksonville Jaguars @ Houston Texans', time: 'Early' },
{ matchup: 'Buffalo Bills @ Miami Dolphins', time: 'Early' },
{ matchup: 'New England Patriots @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'Cleveland Browns @ New York Jets', time: 'Early' },
{ matchup: 'New York Giants @ Chicago Bears', time: 'Early' },
{ matchup: 'New Orleans Saints @ Carolina Panthers', time: 'Early' },
{ matchup: 'Baltimore Ravens @ Minnesota Vikings', time: 'Early' },
{ matchup: 'Arizona Cardinals @ Seattle Seahawks', time: 'Late' },
{ matchup: 'Los Angeles Rams @ San Francisco 49ers', time: 'Late' },
{ matchup: 'Detroit Lions @ Washington Commanders', time: 'Late' },
{ matchup: 'Pittsburgh Steelers @ Los Angeles Chargers', time: 'SNF' },
{ matchup: 'Philadelphia Eagles @ Green Bay Packers', time: 'MNF' }
],
11: [
{ matchup: 'New York Jets @ New England Patriots', time: 'TNF' },
{ matchup: 'Washington Commanders @ Miami Dolphins', time: 'Early' },
{ matchup: 'Tampa Bay Buccaneers @ Buffalo Bills', time: 'Early' },
{ matchup: 'Los Angeles Chargers @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'Cincinnati Bengals @ Pittsburgh Steelers', time: 'Early' },
{ matchup: 'Carolina Panthers @ Atlanta Falcons', time: 'Early' },
{ matchup: 'Green Bay Packers @ New York Giants', time: 'Early' },
{ matchup: 'Chicago Bears @ Minnesota Vikings', time: 'Early' },
{ matchup: 'Houston Texans @ Tennessee Titans', time: 'Early' },
{ matchup: 'San Francisco 49ers @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Seattle Seahawks @ Los Angeles Rams', time: 'Late' },
{ matchup: 'Kansas City Chiefs @ Denver Broncos', time: 'Late' },
{ matchup: 'Baltimore Ravens @ Cleveland Browns', time: 'Late' },
{ matchup: 'Detroit Lions @ Philadelphia Eagles', time: 'SNF' },
{ matchup: 'Dallas Cowboys @ Las Vegas Raiders', time: 'MNF' }
],
12: [
{ matchup: 'Buffalo Bills @ Houston Texans', time: 'TNF' },
{ matchup: 'New England Patriots @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Pittsburgh Steelers @ Chicago Bears', time: 'Early' },
{ matchup: 'Indianapolis Colts @ Kansas City Chiefs', time: 'Early' },
{ matchup: 'New York Jets @ Baltimore Ravens', time: 'Early' },
{ matchup: 'New York Giants @ Detroit Lions', time: 'Early' },
{ matchup: 'Seattle Seahawks @ Tennessee Titans', time: 'Early' },
{ matchup: 'Minnesota Vikings @ Green Bay Packers', time: 'Early' },
{ matchup: 'Cleveland Browns @ Las Vegas Raiders', time: 'Late' },
{ matchup: 'Jacksonville Jaguars @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Atlanta Falcons @ New Orleans Saints', time: 'Late' },
{ matchup: 'Philadelphia Eagles @ Dallas Cowboys', time: 'Late' },
{ matchup: 'Tampa Bay Buccaneers @ Los Angeles Rams', time: 'SNF' },
{ matchup: 'Carolina Panthers @ San Francisco 49ers', time: 'MNF' }
],
13: [
{ matchup: 'Green Bay Packers @ Detroit Lions', time: 'TNF' },
{ matchup: 'Kansas City Chiefs @ Dallas Cowboys', time: 'Early' },
{ matchup: 'Cincinnati Bengals @ Baltimore Ravens', time: 'Late' },
{ matchup: 'Chicago Bears @ Philadelphia Eagles', time: 'Early' },
{ matchup: 'San Francisco 49ers @ Cleveland Browns', time: 'Early' },
{ matchup: 'Jacksonville Jaguars @ Tennessee Titans', time: 'Early' },
{ matchup: 'Houston Texans @ Indianapolis Colts', time: 'Early' },
{ matchup: 'Arizona Cardinals @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'New Orleans Saints @ Miami Dolphins', time: 'Early' },
{ matchup: 'Atlanta Falcons @ New York Jets', time: 'Early' },
{ matchup: 'Los Angeles Rams @ Carolina Panthers', time: 'Early' },
{ matchup: 'Minnesota Vikings @ Seattle Seahawks', time: 'Late' },
{ matchup: 'Buffalo Bills @ Pittsburgh Steelers', time: 'Late' },
{ matchup: 'Las Vegas Raiders @ Los Angeles Chargers', time: 'Late' },
{ matchup: 'Denver Broncos @ Washington Commanders', time: 'SNF' },
{ matchup: 'New York Giants @ New England Patriots', time: 'MNF' }
],
14: [
{ matchup: 'Dallas Cowboys @ Detroit Lions', time: 'TNF' },
{ matchup: 'Indianapolis Colts @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'New Orleans Saints @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'Miami Dolphins @ New York Jets', time: 'Early' },
{ matchup: 'Pittsburgh Steelers @ Baltimore Ravens', time: 'Early' },
{ matchup: 'Seattle Seahawks @ Atlanta Falcons', time: 'Early' },
{ matchup: 'Tennessee Titans @ Cleveland Browns', time: 'Early' },
{ matchup: 'Washington Commanders @ Minnesota Vikings', time: 'Early' },
{ matchup: 'Chicago Bears @ Green Bay Packers', time: 'Early' },
{ matchup: 'Denver Broncos @ Las Vegas Raiders', time: 'Late' },
{ matchup: 'Los Angeles Rams @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Cincinnati Bengals @ Buffalo Bills', time: 'Late' },
{ matchup: 'Houston Texans @ Kansas City Chiefs', time: 'SNF' },
{ matchup: 'Philadelphia Eagles @ Los Angeles Chargers', time: 'MNF' }
],
15: [
{ matchup: 'Atlanta Falcons @ Tampa Bay Buccaneers', time: 'TNF' },
{ matchup: 'Los Angeles Chargers @ Kansas City Chiefs', time: 'Early' },
{ matchup: 'Buffalo Bills @ New England Patriots', time: 'Early' },
{ matchup: 'New York Jets @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'Baltimore Ravens @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Las Vegas Raiders @ Philadelphia Eagles', time: 'Early' },
{ matchup: 'Arizona Cardinals @ Houston Texans', time: 'Early' },
{ matchup: 'Washington Commanders @ New York Giants', time: 'Early' },
{ matchup: 'Cleveland Browns @ Chicago Bears', time: 'Early' },
{ matchup: 'Detroit Lions @ Los Angeles Rams', time: 'Late' },
{ matchup: 'Tennessee Titans @ San Francisco 49ers', time: 'Late' },
{ matchup: 'Carolina Panthers @ New Orleans Saints', time: 'Late' },
{ matchup: 'Green Bay Packers @ Denver Broncos', time: 'Late' },
{ matchup: 'Indianapolis Colts @ Seattle Seahawks', time: 'Late' },
{ matchup: 'Minnesota Vikings @ Dallas Cowboys', time: 'SNF' },
{ matchup: 'Miami Dolphins @ Pittsburgh Steelers', time: 'MNF' }
],
16: [
{ matchup: 'Los Angeles Rams @ Seattle Seahawks', time: 'TNF' },
{ matchup: 'Green Bay Packers @ Chicago Bears', time: 'Early' },
{ matchup: 'Philadelphia Eagles @ Washington Commanders', time: 'Early' },
{ matchup: 'Kansas City Chiefs @ Tennessee Titans', time: 'Early' },
{ matchup: 'New York Jets @ New Orleans Saints', time: 'Early' },
{ matchup: 'New England Patriots @ Baltimore Ravens', time: 'Early' },
{ matchup: 'Buffalo Bills @ Cleveland Browns', time: 'Early' },
{ matchup: 'Tampa Bay Buccaneers @ Carolina Panthers', time: 'Early' },
{ matchup: 'Minnesota Vikings @ New York Giants', time: 'Early' },
{ matchup: 'Los Angeles Chargers @ Dallas Cowboys', time: 'Early' },
{ matchup: 'Atlanta Falcons @ Arizona Cardinals', time: 'Late' },
{ matchup: 'Jacksonville Jaguars @ Denver Broncos', time: 'Late' },
{ matchup: 'Pittsburgh Steelers @ Detroit Lions', time: 'Late' },
{ matchup: 'Las Vegas Raiders @ Houston Texans', time: 'Late' },
{ matchup: 'Cincinnati Bengals @ Miami Dolphins', time: 'SNF' },
{ matchup: 'San Francisco 49ers @ Indianapolis Colts', time: 'MNF' }
],
17: [
{ matchup: 'Dallas Cowboys @ Washington Commanders', time: 'Early' },
{ matchup: 'Detroit Lions @ Minnesota Vikings', time: 'Early' },
{ matchup: 'Denver Broncos @ Kansas City Chiefs', time: 'Late' },
{ matchup: 'New York Giants @ Las Vegas Raiders', time: 'Early' },
{ matchup: 'Houston Texans @ Los Angeles Chargers', time: 'Early' },
{ matchup: 'Arizona Cardinals @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Baltimore Ravens @ Green Bay Packers', time: 'Early' },
{ matchup: 'Seattle Seahawks @ Carolina Panthers', time: 'Early' },
{ matchup: 'New Orleans Saints @ Tennessee Titans', time: 'Early' },
{ matchup: 'Pittsburgh Steelers @ Cleveland Browns', time: 'Early' },
{ matchup: 'New England Patriots @ New York Jets', time: 'Early' },
{ matchup: 'Jacksonville Jaguars @ Indianapolis Colts', time: 'Early' },
{ matchup: 'Tampa Bay Buccaneers @ Miami Dolphins', time: 'Early' },
{ matchup: 'Philadelphia Eagles @ Buffalo Bills', time: 'Late' },
{ matchup: 'Chicago Bears @ San Francisco 49ers', time: 'SNF' },
{ matchup: 'Los Angeles Rams @ Atlanta Falcons', time: 'MNF' }
],
18: [
{ matchup: 'New York Jets @ Buffalo Bills', time: 'Early' },
{ matchup: 'Kansas City Chiefs @ Las Vegas Raiders', time: 'Early' },
{ matchup: 'Baltimore Ravens @ Pittsburgh Steelers', time: 'Early' },
{ matchup: 'Cleveland Browns @ Cincinnati Bengals', time: 'Early' },
{ matchup: 'Miami Dolphins @ New England Patriots', time: 'Early' },
{ matchup: 'Tennessee Titans @ Jacksonville Jaguars', time: 'Early' },
{ matchup: 'Los Angeles Chargers @ Denver Broncos', time: 'Early' },
{ matchup: 'Indianapolis Colts @ Houston Texans', time: 'Early' },
{ matchup: 'Detroit Lions @ Chicago Bears', time: 'Early' },
{ matchup: 'Green Bay Packers @ Minnesota Vikings', time: 'Early' },
{ matchup: 'New Orleans Saints @ Atlanta Falcons', time: 'Early' },
{ matchup: 'Seattle Seahawks @ San Francisco 49ers', time: 'Early' },
{ matchup: 'Washington Commanders @ Philadelphia Eagles', time: 'Early' },
{ matchup: 'Dallas Cowboys @ New York Giants', time: 'Early' },
{ matchup: 'Carolina Panthers @ Tampa Bay Buccaneers', time: 'Early' },
{ matchup: 'Arizona Cardinals @ Los Angeles Rams', time: 'Early' }
]
};

window.onload = function() {
initializeApp();
};

function initializeApp() {
try {
if (typeof firebase !== 'undefined') {
firebase.initializeApp(firebaseConfig);
database = firebase.database();
console.log('Firebase initialized successfully');

// Load data from Firebase
loadDataFromFirebase();
loadBetAmountsFromFirebase();
loadAuditLogFromFirebase();
loadDraftsFromFirebase();
loadSyncSettings();
} else {
console.log('Firebase not available - using local storage only');
}
} catch (error) {
console.error('Firebase error:', error);
}

// Set current week dynamically
var calculatedCurrentWeek = updateCurrentWeekDropdown();
currentWeek = calculatedCurrentWeek;
currentNFLWeek = calculatedCurrentWeek;

// Update the summary week display text
document.getElementById('summaryWeek').textContent = calculatedCurrentWeek;

nflSchedule = nfl2025Schedule;
renderAllPicks();
updateCalculations();
updateLockButtonState();
updatePicksLockState();

}

function loadDataFromFirebase() {
if (!database) return;

// Load weekly picks
database.ref('weeklyPicks').on('value', function(snapshot) {
// Skip if we're currently saving to prevent race condition
if (isSavingToFirebase) {
    console.log('Skipping Firebase load - currently saving');
    return;
}

var data = snapshot.val();
console.log('=== FIREBASE LOAD DEBUG ===');
console.log('Loaded data from Firebase:', data);
console.log('Data is null/undefined?', data === null || data === undefined);
console.log('Current week:', currentWeek);
console.log('Current week data from Firebase:', data ? data[currentWeek] : 'No data');
console.log('Current week data type:', typeof (data ? data[currentWeek] : 'No data'));
console.log('Is current week data an array?', Array.isArray(data ? data[currentWeek] : null));

if (data) {
console.log('=== CONVERSION DEBUG ===');
console.log('Entering conversion block - data exists');
console.log('Data is array?', Array.isArray(data));
console.log('Data type:', typeof data);
console.log('Current week data type:', typeof data[currentWeek]);
console.log('Current week data is array?', Array.isArray(data[currentWeek]));

// Convert Firebase data to proper array structure if needed
if (Array.isArray(data)) {
    console.log('Data is already array, using as-is');
    weeklyPicks = data;
    
    // Check if current week needs conversion
    if (data[currentWeek] && typeof data[currentWeek] === 'object' && !Array.isArray(data[currentWeek])) {
        console.log('Converting current week from object to array');
        var weekData = data[currentWeek];
        var weekArray = [];
        for (var key in weekData) {
            if (weekData.hasOwnProperty(key)) {
                var index = parseInt(key);
                if (!isNaN(index)) {
                    weekArray[index] = weekData[key];
                }
            }
        }
        
        // Pad array to numberOfLegs if needed
        while (weekArray.length < numberOfLegs) {
            weekArray.push(null);
        }
        
        weeklyPicks[currentWeek] = weekArray;
        console.log('Converted week', currentWeek, 'to array with', weekArray.length, 'slots:', weekArray);
    }
} else {
    console.log('Data is object, converting to array structure');
    // Convert object structure to array structure
    weeklyPicks = [];
    for (var week in data) {
        if (data.hasOwnProperty(week)) {
            var weekNum = parseInt(week);
            if (!isNaN(weekNum)) {
                var weekData = data[week];
                // If weekData is an object with numeric keys, convert to array
                if (typeof weekData === 'object' && weekData !== null && !Array.isArray(weekData)) {
                    var weekArray = [];
                    for (var key in weekData) {
                        if (weekData.hasOwnProperty(key)) {
                            var index = parseInt(key);
                            if (!isNaN(index)) {
                                weekArray[index] = weekData[key];
                            }
                        }
                    }
                    weeklyPicks[weekNum] = weekArray;
                } else {
                    weeklyPicks[weekNum] = weekData;
                }
            }
        }
    }
}

console.log('Final weeklyPicks structure:', weeklyPicks);
console.log('Final current week data:', weeklyPicks[currentWeek]);
console.log('Final current week is array?', Array.isArray(weeklyPicks[currentWeek]));

renderAllPicks();
updateCalculations();
updateParlayStatus();
console.log('Loaded picks from Firebase');
}
});

// Load leaderboard data
database.ref('leaderboardData').on('value', function(snapshot) {
var data = snapshot.val();
if (data) {
leaderboardData = data;
updateLeaderboard();
console.log('Loaded leaderboard from Firebase');
}
});

// Load locked weeks
database.ref('lockedWeeks').on('value', function(snapshot) {
var data = snapshot.val();
console.log('Firebase lockedWeeks snapshot:', data);
if (data) {
lockedWeeks = data;
console.log('Updated lockedWeeks:', lockedWeeks);
updateLockButtonState();
updatePicksLockState();
console.log('Loaded locked weeks from Firebase');
} else {
console.log('No locked weeks data found in Firebase');
}
});
}

function saveToFirebase() {
if (!database) {
console.log('Firebase not available - data not saved');
return;
}

try {
// Set flag to prevent Firebase listener from overriding our save
isSavingToFirebase = true;

// Debug: Log what we're trying to save
console.log('=== FIREBASE SAVE DEBUG ===');
console.log('weeklyPicks to save:', weeklyPicks);
console.log('Current week data:', weeklyPicks[currentWeek]);

// Save weekly picks
database.ref('weeklyPicks').set(weeklyPicks).then(function() {
    console.log('weeklyPicks saved successfully');
}).catch(function(error) {
    console.error('Error saving weeklyPicks:', error);
});

// Save locked weeks
console.log('Saving lockedWeeks to Firebase:', lockedWeeks);
database.ref('lockedWeeks').set(lockedWeeks).then(function() {
    console.log('lockedWeeks saved successfully');
}).catch(function(error) {
    console.error('Error saving lockedWeeks:', error);
});

// Update leaderboard data
updateLeaderboardData();
database.ref('leaderboardData').set(leaderboardData).then(function() {
    console.log('leaderboardData saved successfully');
}).catch(function(error) {
    console.error('Error saving leaderboardData:', error);
});

console.log('Data saved to Firebase');

// Clear flag after a short delay to allow Firebase to process
setTimeout(function() {
isSavingToFirebase = false;
}, 1000);

} catch (error) {
console.error('Error saving to Firebase:', error);
showNotification('Error saving to database. Changes may not sync.', 'error');
isSavingToFirebase = false; // Clear flag on error
}
}

function updateWeek() {
currentWeek = parseInt(document.getElementById('currentWeek').value);
currentNFLWeek = currentWeek; // Keep them synced

// Sync the summary week selector
var summarySelect = document.getElementById('summaryWeekSelect');
if (summarySelect) {
summarySelect.value = currentWeek;
}

document.getElementById('summaryWeek').textContent = currentWeek;

// Load bet amount for this week
var currentBetAmount = betAmounts[currentWeek] || 24;
document.getElementById('betAmount').value = currentBetAmount;

renderAllPicks();
updateCalculations();
updateParlayStatus();
updateSummaryBetInfo();

updateLockButtonState();
updatePicksLockState();
}

function updateWeekFromSummary() {
currentWeek = parseInt(document.getElementById('summaryWeekSelect').value);
currentNFLWeek = currentWeek; // Keep them synced

// Sync the main week selector
var mainSelect = document.getElementById('currentWeek');
if (mainSelect) {
mainSelect.value = currentWeek;
}

document.getElementById('summaryWeek').textContent = currentWeek;

// Load bet amount for this week
var currentBetAmount = betAmounts[currentWeek] || 24;
var picksBetAmount = document.getElementById('betAmount');
if (picksBetAmount) {
picksBetAmount.value = currentBetAmount;
}

renderAllPicks();
updateCalculations();
updateParlayStatus();
updateSummaryBetInfo();
updateLockButtonState();
updatePicksLockState();
}

function renderAllPicks() {
var container = document.getElementById('pickSlotsContainer');
container.innerHTML = '';

var savedPicks = weeklyPicks[currentWeek] || [];

// Ensure savedPicks is always an array
if (!Array.isArray(savedPicks)) {
savedPicks = [];
weeklyPicks[currentWeek] = savedPicks;
}

// Preserve unsaved form data before re-rendering
preserveUnsavedFormData();

var numberOfLegs = parseInt(document.getElementById('numberOfLegs').value);

var gameGroups = {};
savedPicks.forEach(function(pick, index) {
if (pick && pick.game && pick.game !== 'TBD' && pick.pick && pick.pick !== 'TBD' && pick.pick !== '' && pick.odds && pick.odds !== 'TBD' && pick.odds !== '') {
if (!gameGroups[pick.game]) {
gameGroups[pick.game] = [];
}
gameGroups[pick.game].push(pick);
}
});

var renderedSlots = {};

for (var game in gameGroups) {
if (gameGroups[game].length >= 2) {
var sgpDiv = createSGPGroup(game, gameGroups[game]);
container.appendChild(sgpDiv);

gameGroups[game].forEach(function(pick) {
var index = savedPicks.indexOf(pick);
if (index >= 0) renderedSlots[index] = true;
});
}
}

for (var i = 0; i < numberOfLegs; i++) {
if (!renderedSlots[i]) {
var pick = savedPicks[i] || null;
var slot = createPickSlot(i, pick);
container.appendChild(slot);
}
}

// Restore unsaved form data after rendering
restoreUnsavedFormData();
}

function createSGPGroup(game, picks) {
var gameId = game.replace(/[^a-zA-Z0-9]/g, '');
var div = document.createElement('div');
div.className = 'sgp-group';

var activeLegs = picks.filter(function(p) { return p.result !== 'draw'; });
var hasOnlyOneLeg = activeLegs.length === 1;

// Determine SGP status
var status = 'PENDING';
var statusClass = 'pending';
var results = picks.map(function(p) { return p.result; });

if (results.every(function(r) { return r === true; })) {
status = 'WIN';
statusClass = 'win';
} else if (results.some(function(r) { return r === false; })) {
status = 'LOSS';
statusClass = 'loss';
} else if (results.some(function(r) { return r === 'draw'; })) {
status = 'DRAW';
statusClass = 'draw';
} else if (picks[0].sgpOdds && picks[0].sgpOdds.trim() !== '') {
status = '✓ SUBMITTED';
statusClass = 'submitted';
}

var sgpOddsStyle = hasOnlyOneLeg ? 
'width: 100px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; text-decoration: line-through; color: #999; background: #f5f5f5;' :
'width: 100px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;';

var sgpOddsValue = picks[0].sgpOdds || '';
var saveButtonStyle = (sgpOddsValue && sgpOddsValue.trim() !== '') ? 
'background: #757575; cursor: not-allowed;' : 
'background: #4CAF50; cursor: pointer;';
var saveButtonText = (sgpOddsValue && sgpOddsValue.trim() !== '') ? 
'💾 SGP Saved' : 
'💾 Save SGP';
var saveButtonDisabled = (sgpOddsValue && sgpOddsValue.trim() !== '') ? 
'disabled' : '';

var html = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
'<div style="font-size: 15px; font-weight: bold; color: #FF9800;">' + game + (hasOnlyOneLeg ? ' (Single Bet)' : '') + '</div>' +
'<span class="result-indicator ' + statusClass + '" style="font-size: 13px;">' + (hasOnlyOneLeg ? '' : 'SGP ') + status + '</span>' +
'</div>' +
'<div style="display: flex; justify-content: flex-end; margin-bottom: 10px;">' +
'<div style="display: flex; align-items: center; gap: 8px; background: white; border: 1px solid #FF9800; border-radius: 6px; padding: 6px 10px;">' +
'<label style="font-size: 13px; font-weight: bold; color: #FF9800; margin: 0;">SGP Odds' + (hasOnlyOneLeg ? ' (not used)' : '') + ':</label>' +
'<input type="text" value="' + sgpOddsValue + '" placeholder="-110, +200" data-game="' + game + '" class="sgp-odds-input" style="' + sgpOddsStyle + '" onblur="formatSGPOddsInput(this)" onchange="enableSGPSaveButton(\'' + game + '\')" data-original="' + sgpOddsValue + '" ' + (hasOnlyOneLeg ? 'readonly' : '') + '>' +
'</div>' +
'</div>';

div.innerHTML = html;

picks.forEach(function(pick) {
var pickIndex = weeklyPicks[currentWeek].indexOf(pick);
var pickDiv = createSGPPickSlot(pickIndex, pick, hasOnlyOneLeg);
div.appendChild(pickDiv);
});

var btnDiv = document.createElement('div');
btnDiv.style.cssText = 'text-align: center; margin-top: 10px;';
var saveBtn = document.createElement('button');
saveBtn.className = 'btn';
saveBtn.style.cssText = saveButtonStyle + '; color: white; padding: 8px 16px; font-size: 13px;';
saveBtn.textContent = saveButtonText;
saveBtn.id = 'sgpSaveBtn_' + gameId;
if (saveButtonDisabled) saveBtn.disabled = true;
saveBtn.onclick = function() {
saveSGPOdds(game);
};
btnDiv.appendChild(saveBtn);
div.appendChild(btnDiv);

return div;
}

function createSGPPickSlot(index, pick, hasOnlyOneLeg) {
var div = document.createElement('div');
div.className = 'pick-slot';
div.style.cssText = 'background: rgba(255, 152, 0, 0.05); border-color: #FFB74D; margin-bottom: 8px; padding: 16px;';

// Determine result status and styling  
var resultClass, resultText;
var isSubmitted = pick && pick.playerName && pick.pick && pick.odds;

if (pick.result === true) {
resultClass = 'win';
resultText = 'WIN';
} else if (pick.result === false) {
resultClass = 'loss';
resultText = 'LOSS';
} else if (pick.result === 'draw') {
resultClass = 'draw';
resultText = 'DRAW';
} else if (isSubmitted) {
resultClass = 'submitted';
resultText = '✓ SUBMITTED';
} else {
resultClass = 'pending';
resultText = 'PENDING';
}

var winActive = pick.result === true ? 'active' : '';
var lossActive = pick.result === false ? 'active' : '';
var drawActive = pick.result === 'draw' ? 'active' : '';

var voidWarning = '';
if (pick.result === 'draw') {
voidWarning = '<div style="background: #FF9800; color: white; padding: 6px; border-radius: 4px; margin-top: 6px; font-size: 11px; font-weight: bold;">⚠️ VOIDED LEG - Removed from SGP calculation</div>';
}

var oddsLabel = hasOnlyOneLeg ? 'Odds' : 'Odds <span style="font-size: 10px; color: #999;">(not used in SGP)</span>';
var oddsStyle = hasOnlyOneLeg ? 'background: white;' : 'text-decoration: line-through; color: #666; background: #f5f5f5;';
var oddsValue = pick.odds || '';

var playerName = pick.playerName || ('Pick ' + (index + 1));

var html;
var isEditing = pick && pick.isEditing;

if (isSubmitted && !isEditing) {
// Truncated view for submitted SGP picks (similar to summary page)
var textStyle = pick.result === 'draw' ? 'text-decoration: line-through; opacity: 0.5;' : '';

html = '<div style="background: linear-gradient(135deg, #FF9800, #F57C00); color: white; padding: 8px 16px; margin: -16px -16px 10px -16px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;">' +
'<div style="display: flex; align-items: center; gap: 8px;">' +
'<span id="playerNameDisplay' + index + '" style="font-size: 16px; font-weight: bold;">' + playerName + '</span>' +
'<input type="text" id="playerNameEdit' + index + '" value="' + playerName + '" style="display: none; padding: 4px 8px; border: 2px solid white; border-radius: 4px; font-size: 14px; font-weight: bold;">' +
'<button onclick="toggleEditPlayerName(' + index + ')" id="editBtn' + index + '" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Edit</button>' +
'</div>' +
'<span class="result-indicator ' + resultClass + '" style="font-size: 12px;">' + resultText + '</span>' +
'</div>' +
'<div style="padding: 12px; ' + textStyle + '">' +
'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">' +
'<div>' +
'<strong>' + playerName + ':</strong> ' + pick.pick +
'<div style="color: #666; font-size: 12px; margin-top: 3px;">' +
(pick.game ? pick.game : 'No game selected') +
' • <strong>' + pick.odds + '</strong>' +
(pick.timeSlot ? ' • <span style="color: #FF9800; font-weight: 500;">' + pick.timeSlot + '</span>' : '') +
'</div>' +
'</div>' +
'<span style="background: ' + (resultClass === 'win' ? '#4CAF50' : resultClass === 'loss' ? '#f44336' : resultClass === 'draw' ? '#FF9800' : '#757575') + '; color: white; padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">' + resultText + '</span>' +
'</div>' +
'</div>' +
'<div style="display: flex; gap: 6px; margin-top: 8px; align-items: center; flex-wrap: wrap; justify-content: space-between;">' +
'<div style="display: flex; gap: 6px;">' +
'<button class="result-btn win ' + winActive + '" onclick="toggleResult(' + index + ', true)" style="padding: 6px 12px; font-size: 12px;">✓ Win</button>' +
'<button class="result-btn loss ' + lossActive + '" onclick="toggleResult(' + index + ', false)" style="padding: 6px 12px; font-size: 12px;">✗ Loss</button>' +
'<button class="result-btn draw ' + drawActive + '" onclick="toggleResult(' + index + ', \'draw\')" style="padding: 6px 12px; font-size: 12px;">🤝 Draw</button>' +
'<button class="result-btn reset" onclick="toggleResult(' + index + ', null)" style="padding: 6px 12px; font-size: 12px;">↻ Reset</button>' +
'</div>' +
'<div style="display: flex; gap: 6px;">' +
'<button class="result-btn" style="background: #2196F3; color: white; padding: 6px 12px; font-size: 12px;" onclick="expandSGPPickSlot(' + index + ')">✏️ Edit Pick</button>' +
'<button class="result-btn" style="background: #f44336; color: white; padding: 6px 12px; font-size: 12px;" onclick="removeSGPPick(' + index + ')">🗑️ Remove</button>' +
'</div>' +
'</div>';
} else {
// Full form view for unsaved SGP picks or when editing
html = '<div style="background: linear-gradient(135deg, #FF9800, #F57C00); color: white; padding: 8px 16px; margin: -16px -16px 10px -16px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;">' +
'<div style="display: flex; align-items: center; gap: 8px;">' +
'<span id="playerNameDisplay' + index + '" style="font-size: 16px; font-weight: bold;">' + playerName + '</span>' +
'<input type="text" id="playerNameEdit' + index + '" value="' + playerName + '" style="display: none; padding: 4px 8px; border: 2px solid white; border-radius: 4px; font-size: 14px; font-weight: bold;">' +
'<button onclick="toggleEditPlayerName(' + index + ')" id="editBtn' + index + '" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">✏️ Edit</button>' +
'</div>' +
'<span class="result-indicator ' + resultClass + '" style="font-size: 12px;">' + resultText + '</span>' +
'</div>' +
'<div class="pick-slot-fields" style="gap: 8px; margin-bottom: 8px;">' +
'<div class="pick-slot-field"><label style="font-size: 11px;">Pick/Bet</label><input type="text" id="pick' + index + '" value="' + (pick.pick || '') + '" ' + (isEditing ? 'onchange="checkForChanges(' + index + ')" data-original="' + (pick.pick || '') + '"' : 'readonly style="background: #f5f5f5; padding: 6px 8px; font-size: 13px;"') + '></div>' +
'<div class="pick-slot-field"><label style="font-size: 11px;">' + oddsLabel + '</label><input type="text" id="odds' + index + '" value="' + oddsValue + '" ' + (isEditing ? 'onblur="formatOdds(' + index + ')" onchange="checkForChanges(' + index + ')" data-original="' + oddsValue + '"' : 'readonly style="' + oddsStyle + '; padding: 6px 8px; font-size: 13px;"') + '></div>' +
'<div class="pick-slot-field"><label style="font-size: 11px;">Game</label>' + (isEditing ? '<select id="game' + index + '" onchange="updateTimeSlotFromGame(' + index + '); checkForChanges(' + index + ')" data-original="' + (pick.game || '') + '"><option value="">Select Game</option>' + generateGameOptions(pick.game) + '</select>' : '<input type="text" value="' + (pick.game || '') + '" readonly style="background: #f5f5f5; padding: 6px 8px; font-size: 13px;">') + '</div>' +
'<div class="pick-slot-field"><label style="font-size: 11px;">Time Slot</label>' + (isEditing ? '<select id="timeSlot' + index + '" onchange="checkForChanges(' + index + ')" data-original="' + (pick.timeSlot || '') + '"><option value="">Select</option><option value="TNF"' + (pick.timeSlot === 'TNF' ? ' selected' : '') + '>TNF</option><option value="Early"' + (pick.timeSlot === 'Early' ? ' selected' : '') + '>Early</option><option value="Late"' + (pick.timeSlot === 'Late' ? ' selected' : '') + '>Late</option><option value="SNF"' + (pick.timeSlot === 'SNF' ? ' selected' : '') + '>SNF</option><option value="MNF"' + (pick.timeSlot === 'MNF' ? ' selected' : '') + '>MNF</option></select>' : '<input type="text" value="' + (pick.timeSlot || '') + '" readonly style="background: #f5f5f5; padding: 6px 8px; font-size: 13px;">') + '</div>' +
'</div>' + voidWarning +
'<div style="display: flex; gap: 6px; margin-top: 8px; align-items: center; flex-wrap: wrap; justify-content: space-between;">' +
'<div style="display: flex; gap: 6px;">' +
'<button class="result-btn win ' + winActive + '" onclick="toggleResult(' + index + ', true)" style="padding: 6px 12px; font-size: 12px;">✓ Win</button>' +
'<button class="result-btn loss ' + lossActive + '" onclick="toggleResult(' + index + ', false)" style="padding: 6px 12px; font-size: 12px;">✗ Loss</button>' +
'<button class="result-btn draw ' + drawActive + '" onclick="toggleResult(' + index + ', \'draw\')" style="padding: 6px 12px; font-size: 12px;">🤝 Draw</button>' +
'<button class="result-btn reset" onclick="toggleResult(' + index + ', null)" style="padding: 6px 12px; font-size: 12px;">↻ Reset</button>' +
'</div>' +
'<div style="border-left: 1px solid #ddd; padding-left: 6px; margin-left: 6px; display: flex; gap: 6px;">' +
(isEditing ? '<button class="result-btn" id="saveBtn' + index + '" style="background: #757575; color: white; cursor: not-allowed;" onclick="savePick(' + index + ')" disabled>💾 Save</button><button class="result-btn" style="background: #6b7280; color: white; padding: 6px 12px; font-size: 12px;" onclick="cancelEditSGPPick(' + index + ')">❌ Cancel</button>' : '<button class="result-btn" style="background: #2196F3; color: white; padding: 6px 12px; font-size: 12px;" onclick="expandSGPPickSlot(' + index + ')">✏️ Edit Pick</button>') +
'<button class="result-btn" style="background: #f44336; color: white; padding: 6px 12px; font-size: 12px;" onclick="removeSGPPick(' + index + ')">🗑️ Remove</button>' +
'</div>' +
'</div>';
}

div.innerHTML = html;
return div;
}

function createPickSlot(index, pick) {
var div = document.createElement('div');
var className = 'pick-slot';
if (pick) {
if (pick.playerName && pick.pick && pick.odds) className += ' filled';
if (pick.result === true) className += ' win';
else if (pick.result === false) className += ' loss';
else if (pick.result === 'draw') className += ' draw';
}
div.className = className;

// Determine result status and styling
var resultClass, resultText;
var isSubmitted = pick && pick.playerName && pick.pick && pick.odds;
var isEditing = pick && pick.isEditing;

if (pick && pick.result === true) {
resultClass = 'win';
resultText = 'WIN';
} else if (pick && pick.result === false) {
resultClass = 'loss'; 
resultText = 'LOSS';
} else if (pick && pick.result === 'draw') {
resultClass = 'draw';
resultText = 'DRAW';
} else if (isSubmitted) {
resultClass = 'submitted';
resultText = '✓ SUBMITTED';
} else {
resultClass = 'pending';
resultText = 'PENDING';
}

var winActive = pick && pick.result === true ? 'active' : '';
var lossActive = pick && pick.result === false ? 'active' : '';
var drawActive = pick && pick.result === 'draw' ? 'active' : '';

var voidWarning = '';
if (pick && pick.result === 'draw') {
voidWarning = '<div style="background: #FF9800; color: white; padding: 8px; border-radius: 4px; margin-top: 10px; font-size: 12px; font-weight: bold;">⚠️ VOIDED LEG - Removed from parlay calculation</div>';
}

var defaultName = index < playerNames.length ? playerNames[index] : 'Pick ' + (index + 1);
var playerName = pick && pick.playerName ? pick.playerName : defaultName;

var html;

if (isSubmitted && !isEditing) {
// Truncated view for submitted picks (similar to summary page)
var textStyle = pick.result === 'draw' ? 'text-decoration: line-through; opacity: 0.5;' : '';

html = '<div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 12px 20px; margin: -20px -20px 15px -20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">' +
'<div style="display: flex; align-items: center; gap: 10px;">' +
'<span id="playerNameDisplay' + index + '" style="font-size: 18px; font-weight: bold;">' + playerName + '</span>' +
'<input type="text" id="playerNameEdit' + index + '" value="' + playerName + '" style="display: none; padding: 6px 10px; border: 2px solid white; border-radius: 4px; font-size: 16px; font-weight: bold;">' +
'<button onclick="toggleEditPlayerName(' + index + ')" id="editBtn' + index + '" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;">✏️ Edit</button>' +
'</div>' +
'<span class="result-indicator ' + resultClass + '">' + resultText + '</span>' +
'</div>' +
'<div style="padding: 16px; ' + textStyle + '">' +
'<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">' +
'<div>' +
'<strong>' + playerName + ':</strong> ' + pick.pick +
'<div style="color: #666; font-size: 13px; margin-top: 4px;">' +
(pick.game ? pick.game : 'No game selected') +
' • <strong>' + pick.odds + '</strong>' +
(pick.timeSlot ? ' • <span style="color: #3b82f6; font-weight: 500;">' + pick.timeSlot + '</span>' : '') +
'</div>' +
'</div>' +
'<span style="background: ' + (resultClass === 'win' ? '#4CAF50' : resultClass === 'loss' ? '#f44336' : resultClass === 'draw' ? '#FF9800' : '#757575') + '; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">' + resultText + '</span>' +
'</div>' +
'</div>' +
'<div style="display: flex; gap: 8px; margin-top: 15px; align-items: center; flex-wrap: wrap; justify-content: space-between;">' +
'<div style="display: flex; gap: 8px;">' +
'<button class="result-btn win ' + winActive + '" onclick="toggleResult(' + index + ', true)">✓ Win</button>' +
'<button class="result-btn loss ' + lossActive + '" onclick="toggleResult(' + index + ', false)">✗ Loss</button>' +
'<button class="result-btn draw ' + drawActive + '" onclick="toggleResult(' + index + ', \'draw\')">🤝 Draw</button>' +
'<button class="result-btn reset" onclick="toggleResult(' + index + ', null)">↻ Reset</button>' +
'</div>' +
'<div style="display: flex; gap: 8px;">' +
'<button class="result-btn" style="background: #2196F3; color: white;" onclick="expandPickSlot(' + index + ')">✏️ Edit Pick</button>' +
'<button class="result-btn" style="background: #f44336; color: white;" onclick="clearIndividualPick(' + index + ')">🗑️ Clear Pick</button>' +
'</div>' +
'</div>';
} else {
// Full form view for unsaved picks
html = '<div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 12px 20px; margin: -20px -20px 15px -20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">' +
'<div style="display: flex; align-items: center; gap: 10px;">' +
'<span id="playerNameDisplay' + index + '" style="font-size: 18px; font-weight: bold;">' + playerName + '</span>' +
'<input type="text" id="playerNameEdit' + index + '" value="' + playerName + '" style="display: none; padding: 6px 10px; border: 2px solid white; border-radius: 4px; font-size: 16px; font-weight: bold;">' +
'<button onclick="toggleEditPlayerName(' + index + ')" id="editBtn' + index + '" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 14px;">✏️ Edit</button>' +
'</div>' +
'<span class="result-indicator ' + resultClass + '">' + resultText + '</span>' +
'</div>' +
'<div class="pick-slot-fields">' +
'<div class="pick-slot-field"><label>Pick/Bet</label><input type="text" id="pick' + index + '" value="' + (pick ? pick.pick || '' : '') + '" placeholder="Team to win, over/under" onchange="checkForChanges(' + index + ')" data-original="' + (pick ? pick.pick || '' : '') + '"></div>' +
'<div class="pick-slot-field"><label>Odds</label><input type="text" id="odds' + index + '" value="' + (pick ? pick.odds || '' : '') + '" placeholder="-110, +200" onblur="formatOdds(' + index + ')" onchange="checkForChanges(' + index + ')" data-original="' + (pick ? pick.odds || '' : '') + '"></div>' +
'<div class="pick-slot-field"><label>Game</label><select id="game' + index + '" onchange="updateTimeSlotFromGame(' + index + '); checkForChanges(' + index + ')" data-original="' + (pick ? pick.game || '' : '') + '"><option value="">Select Game</option>' + generateGameOptions(pick ? pick.game : '') + '</select></div>' +
'<div class="pick-slot-field"><label>Time Slot</label><select id="timeSlot' + index + '" onchange="checkForChanges(' + index + ')" data-original="' + (pick ? pick.timeSlot || '' : '') + '"><option value="">Select</option>' +
'<option value="TNF"' + (pick && pick.timeSlot === 'TNF' ? ' selected' : '') + '>TNF</option>' +
'<option value="Early"' + (pick && pick.timeSlot === 'Early' ? ' selected' : '') + '>Early</option>' +
'<option value="Late"' + (pick && pick.timeSlot === 'Late' ? ' selected' : '') + '>Late</option>' +
'<option value="SNF"' + (pick && pick.timeSlot === 'SNF' ? ' selected' : '') + '>SNF</option>' +
'<option value="MNF"' + (pick && pick.timeSlot === 'MNF' ? ' selected' : '') + '>MNF</option>' +
'</select></div>' +
'</div>' + voidWarning +
'<div style="display: flex; gap: 8px; margin-top: 15px; align-items: center; flex-wrap: wrap; justify-content: space-between;">' +
'<div style="display: flex; gap: 8px;">' +
'<button class="result-btn win ' + winActive + '" onclick="toggleResult(' + index + ', true)">✓ Win</button>' +
'<button class="result-btn loss ' + lossActive + '" onclick="toggleResult(' + index + ', false)">✗ Loss</button>' +
'<button class="result-btn draw ' + drawActive + '" onclick="toggleResult(' + index + ', \'draw\')">🤝 Draw</button>' +
'<button class="result-btn reset" onclick="toggleResult(' + index + ', null)">↻ Reset</button>' +
'</div>' +
'<div style="display: flex; gap: 8px;">' +
'<button class="result-btn" id="saveBtn' + index + '" style="background: #757575; color: white; cursor: not-allowed;" onclick="savePick(' + index + ')" disabled>💾 Save</button>' +
(isEditing ? '<button class="result-btn" style="background: #6b7280; color: white;" onclick="cancelEditPick(' + index + ')">❌ Cancel</button>' : '') +
'<button class="result-btn" style="background: #f44336; color: white;" onclick="clearIndividualPick(' + index + ')">🗑️ Clear Pick</button>' +
'</div>' +
'</div>';
}

div.innerHTML = html;
return div;
}

function expandPickSlot(index) {
// Mark the pick as being edited so it shows the full form
if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
weeklyPicks[currentWeek][index].isEditing = true;
renderAllPicks();
}
}

function expandSGPPickSlot(index) {
// Mark the SGP pick as being edited so it shows the full form
if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
weeklyPicks[currentWeek][index].isEditing = true;
renderAllPicks();
}
}

function cancelEditPick(index) {
// Cancel editing mode and return to truncated view
console.log('cancelEditPick called with index:', index);
if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
console.log('Setting isEditing to false for pick:', index);
weeklyPicks[currentWeek][index].isEditing = false;
renderAllPicks();
}
}

function cancelEditSGPPick(index) {
// Cancel editing mode for SGP pick and return to truncated view
console.log('cancelEditSGPPick called with index:', index);
if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
console.log('Setting isEditing to false for SGP pick:', index);
weeklyPicks[currentWeek][index].isEditing = false;
renderAllPicks();
}
}

function toggleEditPlayerName(index) {
var display = document.getElementById('playerNameDisplay' + index);
var edit = document.getElementById('playerNameEdit' + index);
var btn = document.getElementById('editBtn' + index);

if (edit.style.display === 'none') {
display.style.display = 'none';
edit.style.display = 'inline-block';
edit.focus();
edit.select();
btn.textContent = '✓ Save';
} else {
var newName = edit.value.trim();
if (newName) {
display.textContent = newName;
display.style.display = 'inline';
edit.style.display = 'none';
btn.textContent = '✏️ Edit';

if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
weeklyPicks[currentWeek][index].playerName = newName;
}

// Check for changes after updating player name
checkForChanges(index);
updateCalculations();
}
}
}

function checkForChanges(index) {
var pickInput = document.getElementById('pick' + index);
var oddsInput = document.getElementById('odds' + index);
var gameSelect = document.getElementById('game' + index);
var timeSlotSelect = document.getElementById('timeSlot' + index);
var playerNameDisplay = document.getElementById('playerNameDisplay' + index);

if (!pickInput || !oddsInput || !gameSelect || !timeSlotSelect) return;

// Get current values
var currentPick = pickInput.value.trim();
var currentOdds = oddsInput.value.trim();
var currentGame = gameSelect.value;
var currentTimeSlot = timeSlotSelect.value;
var currentPlayerName = playerNameDisplay ? playerNameDisplay.textContent.trim() : '';

// Get original values
var originalPick = pickInput.getAttribute('data-original') || '';
var originalOdds = oddsInput.getAttribute('data-original') || '';
var originalGame = gameSelect.getAttribute('data-original') || '';
var originalTimeSlot = timeSlotSelect.getAttribute('data-original') || '';
var originalPlayerName = index < playerNames.length ? playerNames[index] : 'Pick ' + (index + 1);

// Get saved player name if exists
if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index] && weeklyPicks[currentWeek][index].playerName) {
originalPlayerName = weeklyPicks[currentWeek][index].playerName;
}

// Check if any values have actually changed
var hasChanges = currentPick !== originalPick ||
currentOdds !== originalOdds ||
currentGame !== originalGame ||
currentTimeSlot !== originalTimeSlot ||
currentPlayerName !== originalPlayerName;

var saveBtn = document.getElementById('saveBtn' + index);
if (saveBtn) {
if (hasChanges) {
saveBtn.disabled = false;
saveBtn.style.background = '#2196F3';
saveBtn.style.cursor = 'pointer';
saveBtn.textContent = '💾 Save Changes';
} else {
saveBtn.disabled = true;
saveBtn.style.background = '#757575';
saveBtn.style.cursor = 'not-allowed';
saveBtn.textContent = '💾 Save';
}
}
}

function enableSGPSaveButton(game) {
var input = document.querySelector('.sgp-odds-input[data-game="' + game + '"]');
var gameId = game.replace(/[^a-zA-Z0-9]/g, '');
var saveBtn = document.getElementById('sgpSaveBtn_' + gameId);

if (!input || !saveBtn) return;

var currentValue = input.value.trim();
var originalValue = input.getAttribute('data-original') || '';

var hasChanges = currentValue !== originalValue;

if (hasChanges) {
saveBtn.disabled = false;
saveBtn.style.background = '#4CAF50';
saveBtn.style.cursor = 'pointer';
saveBtn.textContent = '💾 Save SGP Changes';
} else {
saveBtn.disabled = true;
saveBtn.style.background = '#757575';
saveBtn.style.cursor = 'not-allowed';
saveBtn.textContent = '💾 Save SGP';
}
}

function enableSaveButton(index) {
// Deprecated - use checkForChanges instead
checkForChanges(index);
}

function disableSaveButton(index) {
var saveBtn = document.getElementById('saveBtn' + index);
if (saveBtn) {
saveBtn.disabled = true;
saveBtn.style.background = '#757575';
saveBtn.style.cursor = 'not-allowed';
saveBtn.textContent = '💾 Saved';

// Update the data-original attributes to current values after save
var pickInput = document.getElementById('pick' + index);
var oddsInput = document.getElementById('odds' + index);
var gameSelect = document.getElementById('game' + index);
var timeSlotSelect = document.getElementById('timeSlot' + index);

if (pickInput) pickInput.setAttribute('data-original', pickInput.value);
if (oddsInput) oddsInput.setAttribute('data-original', oddsInput.value);
if (gameSelect) gameSelect.setAttribute('data-original', gameSelect.value);
if (timeSlotSelect) timeSlotSelect.setAttribute('data-original', timeSlotSelect.value);
}
}

function savePick(index) {
var playerNameDisplay = document.getElementById('playerNameDisplay' + index);
var playerName = playerNameDisplay ? playerNameDisplay.textContent.trim() : '';
var pick = document.getElementById('pick' + index).value.trim();
var odds = document.getElementById('odds' + index).value.trim();
var game = document.getElementById('game' + index).value;
var timeSlot = document.getElementById('timeSlot' + index).value;

if (!playerName || !pick || !odds) {
showNotification('Please fill in Player Name, Pick, and Odds before saving.', 'error');
return;
}

if (!weeklyPicks[currentWeek]) {
weeklyPicks[currentWeek] = [];
}

// Ensure it's an array (safety check)
if (!Array.isArray(weeklyPicks[currentWeek])) {
weeklyPicks[currentWeek] = [];
}

var pickData = {
playerName: playerName,
pick: pick,
odds: odds,
game: game,
timeSlot: timeSlot,
result: weeklyPicks[currentWeek][index] ? weeklyPicks[currentWeek][index].result : null,
timestamp: Date.now(),
isEditing: false // Clear editing flag when saving
};

while (weeklyPicks[currentWeek].length <= index) {
weeklyPicks[currentWeek].push(null);
}
weeklyPicks[currentWeek][index] = pickData;

// Log audit entry
var isNewPick = !weeklyPicks[currentWeek][index];
var action = isNewPick ? 'Added pick' : 'Updated pick';
var details = playerName + ': ' + pick + ' (' + odds + ') - ' + game;
logAuditEntry(currentWeek, action, details);

// Save to Firebase
saveToFirebase();


// Show prominent save confirmation
showNotification('Pick saved and synced to all users!', 'success');

// Get the pick slot element before re-rendering
var pickSlot = document.getElementById('saveBtn' + index);
if (pickSlot) {
    pickSlot = pickSlot.closest('.pick-slot');
}

// Update UI to reflect saved state
renderAllPicks();
updateCalculations();
updateParlayStatus();

// Disable save button and show "Saved" state
disableSaveButton(index);

// Add a temporary blue flash to the pick slot
if (pickSlot) {
    pickSlot.style.transition = 'all 0.3s ease';
    pickSlot.style.transform = 'scale(1.02)';
    pickSlot.style.boxShadow = '0 8px 20px rgba(33, 150, 243, 0.3)';
    setTimeout(function() {
        pickSlot.style.transform = 'scale(1)';
        pickSlot.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
    }, 300);
}

checkForSGPs();
updateCalculations();
renderAllPicks();
}

function checkForSGPs() {
var picks = weeklyPicks[currentWeek] || [];
var gameGroups = {};

picks.forEach(function(pick) {
if (pick && pick.game && pick.game !== 'TBD' && pick.pick && pick.pick !== 'TBD' && pick.pick !== '' && pick.odds && pick.odds !== 'TBD' && pick.odds !== '') {
if (!gameGroups[pick.game]) {
gameGroups[pick.game] = [];
}
gameGroups[pick.game].push(pick);
}
});

for (var game in gameGroups) {
if (gameGroups[game].length >= 2) {
showNotification('🎯 SGP Auto-Detected! ' + gameGroups[game].length + ' picks for ' + game + '. Please enter SGP odds from your sportsbook.', 'warning');
}
}
}

function saveSGPOdds(game) {
var input = document.querySelector('.sgp-odds-input[data-game="' + game + '"]');
var sgpOdds = input ? input.value.trim() : '';

if (!sgpOdds) {
alert('Please enter the SGP odds from your sportsbook before saving.');
if (input) input.focus();
return;
}

var picks = weeklyPicks[currentWeek] || [];
var updated = 0;
picks.forEach(function(pick) {
if (pick && pick.game === game) {
pick.sgpOdds = sgpOdds;
pick.isSGP = true;
updated++;
}
});

saveToFirebase();
showNotification('✓ SGP saved successfully for ' + game + '!', 'success');
updateCalculations();
renderAllPicks();
}

function toggleResult(index, result) {
if (!weeklyPicks[currentWeek] || !weeklyPicks[currentWeek][index]) return;

var pick = weeklyPicks[currentWeek][index];

var oldResult = pick.result;
if (pick.result === result) {
pick.result = null;
} else {
pick.result = result;
}

// Log audit entry
var action = oldResult === result ? 'Reset result' : 'Set result to ' + result;
var details = pick.playerName + ': ' + pick.pick + ' (' + pick.odds + ')';
logAuditEntry(currentWeek, action, details);

if (result === 'draw' && pick.isSGP && pick.game) {
handleSGPVoid(pick.game);
}

// Save changes to Firebase
saveToFirebase();

updateCalculations();
updateLeaderboardData();
renderAllPicks();

// Update parlay status when results change
updateParlayStatus();
}

function handleSGPVoid(game) {
var picks = weeklyPicks[currentWeek] || [];
var gamePicksActive = picks.filter(function(p) { return p && p.game === game && p.result !== 'draw'; });

if (gamePicksActive.length === 1) {
picks.forEach(function(pick) {
if (pick && pick.game === game) {
pick.isSGP = false;
// Keep sgpOdds to display crossed out, don't set to null
}
});
showNotification('⚠️ SGP reduced to 1 leg - now a single bet at ' + gamePicksActive[0].odds, 'warning');
} else if (gamePicksActive.length >= 2) {
var voidedCount = picks.filter(function(p) { return p && p.game === game && p.result === 'draw'; }).length;
showNotification('⚠️ ' + voidedCount + ' leg(s) voided from SGP. ' + gamePicksActive.length + ' legs remain. Please enter new SGP odds!', 'warning');
}
}

function formatOdds(index) {
var oddsInput = document.getElementById('odds' + index);
if (!oddsInput) return;

var oddsValue = oddsInput.value.trim();
if (!oddsValue) return;

var cleanOdds = oddsValue.replace(/[+-]/g, '');
if (isNaN(cleanOdds) || cleanOdds === '') return;

var numericOdds = parseInt(cleanOdds);

if (!oddsValue.includes('+') && !oddsValue.includes('-')) {
if (numericOdds >= 100) {
oddsInput.value = '+' + numericOdds;
} else {
oddsInput.value = '-' + numericOdds;
}
} else if (oddsValue.startsWith('+') || oddsValue.startsWith('-')) {
oddsInput.value = oddsValue.charAt(0) + numericOdds;
}
}

function formatSGPOddsInput(input) {
var oddsValue = input.value.trim();
if (!oddsValue) return;

var cleanOdds = oddsValue.replace(/[+-]/g, '');
if (isNaN(cleanOdds) || cleanOdds === '') return;

var numericOdds = parseInt(cleanOdds);

if (!oddsValue.includes('+') && !oddsValue.includes('-')) {
if (numericOdds >= 100) {
input.value = '+' + numericOdds;
} else {
input.value = '-' + numericOdds;
}
} else if (oddsValue.startsWith('+') || oddsValue.startsWith('-')) {
input.value = oddsValue.charAt(0) + numericOdds;
}
}

function updateTimeSlotFromGame(index) {
var gameSelect = document.getElementById('game' + index);
var timeSlotSelect = document.getElementById('timeSlot' + index);

if (!gameSelect || !timeSlotSelect) return;

var selectedGame = gameSelect.value;
if (!selectedGame) return;

var schedule = nflSchedule[currentNFLWeek] || [];
var game = schedule.find(function(g) {
return g.matchup === selectedGame;
});

if (game) {
timeSlotSelect.value = game.time;
}
}

function getTimeSlotFromGame(gameName) {
if (!gameName) return '';
var schedule = nflSchedule[currentNFLWeek] || [];
var game = schedule.find(function(g) {
return g.matchup === gameName;
});
return game ? game.time : '';
}

function updateTimeSlotDropdownsFromSync() {
// Use the existing manual game selection logic to auto-select time slots
var picks = weeklyPicks[currentWeek] || [];
console.log('updateTimeSlotDropdownsFromSync: Processing', picks.length, 'picks');

picks.forEach(function(pick, index) {
    if (pick && pick.game) {
        console.log('Pick', index, '- Game:', pick.game, 'Calling updateTimeSlotFromGame');
        // Use the existing manual logic to auto-select time slot
        updateTimeSlotFromGame(index);
        
        // Also update the pick data with the selected time slot
        var timeSlotSelect = document.getElementById('timeSlot' + index);
        if (timeSlotSelect && timeSlotSelect.value) {
            pick.timeSlot = timeSlotSelect.value;
            console.log('Updated pick timeSlot to:', pick.timeSlot);
        }
    }
});
}

function generateGameOptions(selectedGame) {
var schedule = nflSchedule[currentNFLWeek] || [];
return schedule.map(function(game) {
return '<option value="' + game.matchup + '"' + (selectedGame === game.matchup ? ' selected' : '') + '>' +
game.matchup + ' (' + game.time + ')' +
'</option>';
}).join('');
}

function showNotification(message, type) {
var colors = {
success: '#4CAF50',
warning: '#FF9800',
error: '#f44336',
info: '#2196F3'
};

var notification = document.createElement('div');
notification.style.cssText =
'position: fixed; top: 20px; right: 20px; background: ' + colors[type] + '; color: white; ' +
'padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); ' +
'z-index: 1000; font-weight: bold; max-width: 300px;';
notification.textContent = message;

document.body.appendChild(notification);

setTimeout(function() {
if (notification.parentNode) {
notification.parentNode.removeChild(notification);
}
}, 3000);
}

function americanToDecimal(american) {
// Handle invalid odds values
if (!american || american === 'No odds' || american === '' || isNaN(parseFloat(american.replace('+', '')))) {
    return 1; // Return 1:1 odds for invalid values
}

var odds = parseFloat(american.replace('+', ''));
if (odds > 0) {
return (odds / 100) + 1;
} else {
return (100 / Math.abs(odds)) + 1;
}
}

function decimalToAmerican(decimal) {
if (decimal >= 2) {
return '+' + Math.round((decimal - 1) * 100);
} else {
return '-' + Math.round(100 / (decimal - 1));
}
}

function confirmBetAmountUpdate() {
var newBetAmount = parseFloat(document.getElementById('betAmount').value);

if (!newBetAmount || newBetAmount < 1) {
showNotification('Please enter a valid bet amount (minimum $1)', 'error');
return;
}

var currentBetAmount = betAmounts[currentWeek] || 24;

if (newBetAmount === currentBetAmount) {
showNotification('Bet amount is already set to $' + newBetAmount.toFixed(0), 'info');
return;
}

// Show confirmation dialog
var confirmMessage = 'Update bet amount from $' + currentBetAmount.toFixed(0) + ' to $' + newBetAmount.toFixed(0) + '?';
if (confirm(confirmMessage)) {
betAmounts[currentWeek] = newBetAmount;
saveBetAmountsToFirebase();
updateBetCalculations();
showNotification('Bet amount updated to $' + newBetAmount.toFixed(0), 'success');
} else {
// Reset input to current value if cancelled
document.getElementById('betAmount').value = currentBetAmount;
}
}

function togglePicksLock() {
if (lockedWeeks[currentWeek]) {
// Try to unlock this week
var password = prompt('Enter password to unlock Week ' + currentWeek + ' picks:');
if (password === lockPassword) {
unlockPicks();
} else if (password !== null) {
showNotification('Incorrect password', 'error');
}
} else {
// Lock this week
lockPicks();
}
}

function lockPicks() {
    // Prompt for password when locking
    var password = prompt('Enter password to lock Week ' + currentWeek + ' picks:');
    if (password === lockPassword) {
        lockedWeeks[currentWeek] = true;
        console.log('Locking week', currentWeek, 'lockedWeeks:', lockedWeeks);
        var lockBtn = document.getElementById('lockBtn');
        lockBtn.innerHTML = '🔓 Unlock Week ' + currentWeek;
        lockBtn.style.background = '#10b981';

        // Apply lock styling to picks tab content
        var picksContent = document.getElementById('picks');
        picksContent.classList.add('picks-locked');

        // Save to Firebase
        saveToFirebase();

        showNotification('Week ' + currentWeek + ' picks locked', 'info');
    } else if (password !== null) {
        showNotification('Incorrect password', 'error');
    }
}

function unlockPicks() {
lockedWeeks[currentWeek] = false;
var lockBtn = document.getElementById('lockBtn');
lockBtn.innerHTML = '🔒 Lock Week ' + currentWeek;
lockBtn.style.background = '#ef4444';

// Remove lock styling from picks tab content
var picksContent = document.getElementById('picks');
picksContent.classList.remove('picks-locked');

// Save to Firebase
saveToFirebase();

showNotification('Week ' + currentWeek + ' picks unlocked', 'success');
}

function updateLockButtonState() {
var lockBtn = document.getElementById('lockBtn');
console.log('updateLockButtonState - currentWeek:', currentWeek, 'lockedWeeks:', lockedWeeks, 'isLocked:', lockedWeeks[currentWeek]);
if (lockedWeeks[currentWeek]) {
lockBtn.innerHTML = '🔓 Unlock Week ' + currentWeek;
lockBtn.style.background = '#10b981';
} else {
lockBtn.innerHTML = '🔒 Lock Week ' + currentWeek;
lockBtn.style.background = '#ef4444';
}
}

function updatePicksLockState() {
    var picksContent = document.getElementById('picks');
    if (lockedWeeks[currentWeek]) {
        picksContent.classList.add('picks-locked');
    } else {
        picksContent.classList.remove('picks-locked');
    }
}

// Google Sheets Sync Functions
function configureSheetsSync() {
    showSheetsConfigModal();
}

function showSheetsConfigModal() {
    // Create modal HTML
    var modalHtml = `
        <div id="sheetsConfigModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h2 style="margin: 0 0 20px 0; color: #333; font-size: 20px;">📊 Configure Google Sheets Sync</h2>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 500; color: #374151; margin-bottom: 6px;">Google Spreadsheet URL:</label>
                    <input type="url" id="spreadsheetUrlInput" placeholder="https://docs.google.com/spreadsheets/d/..." 
                           style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
                           value="${sheetsConfig.spreadsheetId ? 'https://docs.google.com/spreadsheets/d/' + sheetsConfig.spreadsheetId : ''}">
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Copy the full URL from your browser when viewing the spreadsheet</div>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 500; color: #374151; margin-bottom: 6px;">CURRENT WEEK Sheet GID:</label>
                    <input type="text" id="currentWeekGidInput" placeholder="1234567890" 
                           style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
                           value="${sheetsConfig.currentWeekGid || ''}">
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">Find this in the sheet URL: .../edit#gid=1234567890</div>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="enableAutoSyncCheckbox" ${sheetsConfig.autoSyncEnabled ? 'checked' : ''}>
                        <span style="font-weight: 500; color: #374151;">Enable auto-sync (every 5 minutes)</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 12px; margin-top: 24px;">
                    <button onclick="saveSheetsConfig()" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;">
                        💾 Save Configuration
                    </button>
                    <button onclick="closeSheetsConfigModal()" style="flex: 1; background: #6b7280; color: white; border: none; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;">
                        ❌ Cancel
                    </button>
                </div>
                
                ${sheetsConfig.spreadsheetId ? `
                <div style="margin-top: 16px; text-align: center;">
                    <button onclick="removeSheetsSyncFromModal()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;">
                        🗑️ Remove Sync Configuration
                    </button>
                </div>
                ` : ''}
                
                <div style="margin-top: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; border-left: 4px solid #3b82f6;">
                    <div style="font-size: 12px; color: #666; font-weight: 500; margin-bottom: 4px;">💡 How to find the GID:</div>
                    <div style="font-size: 11px; color: #666; line-height: 1.4;">
                        1. Open your spreadsheet in Google Sheets<br>
                        2. Click on the "CURRENT WEEK" tab<br>
                        3. Look at the URL in your browser<br>
                        4. Find the number after "gid=" (e.g., gid=1234567890)<br>
                        5. Copy that number into the GID field above
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding: 12px; background: #f0f9ff; border-radius: 6px; border-left: 4px solid #0ea5e9;">
                    <div style="font-size: 12px; color: #666; font-weight: 500; margin-bottom: 4px;">📋 Expected Spreadsheet Format:</div>
                    <div style="font-size: 11px; color: #666; line-height: 1.4;">
                        <strong>Columns:</strong> A: Player Name | B: Pick | C: Odds | D: [Other] | E: [Other] | F: [Other] | G: Game (Team Abbreviation) | H: Time Slot<br>
                        <strong>Examples:</strong> Michael Dixon | Chiefs -3.5 | -110 | [other data] | [other data] | [other data] | KC | 1:00 PM<br>
                        <strong>Team Abbreviations:</strong> KC, GB, NE, SF, etc. (see full list in console)
                    </div>
                </div>
                
                <div style="margin-top: 12px; padding: 12px; background: #fef3c7; border-radius: 6px; border-left: 4px solid #f59e0b;">
                    <div style="font-size: 12px; color: #666; font-weight: 500; margin-bottom: 4px;">👥 Valid Player Names:</div>
                    <div style="font-size: 11px; color: #666; line-height: 1.4;">
                        Only picks for these players will be imported:<br>
                        <span id="validPlayersList" style="font-family: monospace; background: #f3f4f6; padding: 2px 4px; border-radius: 3px;">
                            ${getValidPlayerNames().join(', ')}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Add event listeners
    var modal = document.getElementById('sheetsConfigModal');
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeSheetsConfigModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && document.getElementById('sheetsConfigModal')) {
            closeSheetsConfigModal();
        }
    });
    
    // Focus on first input
    setTimeout(() => {
        document.getElementById('spreadsheetUrlInput').focus();
    }, 100);
}

function saveSheetsConfig() {
    var spreadsheetUrl = document.getElementById('spreadsheetUrlInput').value.trim();
    var currentWeekGid = document.getElementById('currentWeekGidInput').value.trim();
    var enableAutoSync = document.getElementById('enableAutoSyncCheckbox').checked;
    
    if (!spreadsheetUrl) {
        showNotification('Please enter the Google Spreadsheet URL', 'error');
        return;
    }
    
    // Extract spreadsheet ID from URL
    var match = spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        showNotification('Invalid Google Spreadsheet URL', 'error');
        return;
    }
    
    sheetsConfig.spreadsheetId = match[1];
    
    if (!currentWeekGid) {
        showNotification('Please enter the CURRENT WEEK sheet GID', 'error');
        return;
    }
    
    sheetsConfig.currentWeekGid = currentWeekGid;
    
    // Ask if user wants to configure week GIDs
    if (confirm('Do you want to configure GIDs for individual weeks (Week 1, Week 2, etc.)?\n\nThis allows syncing from specific week sheets instead of just "CURRENT WEEK".')) {
        configureWeekGids();
    }
    
    // Handle auto-sync
    if (enableAutoSync) {
        enableAutoSync();
    } else {
        disableAutoSync();
    }
    
    // Save sync settings to localStorage and Firebase
    saveSyncSettings();
    
    closeSheetsConfigModal();
    updateSyncStatus();
    showNotification('Google Sheets sync configured!', 'success');
    console.log('Sheets config:', sheetsConfig);
    console.log('Available team abbreviations:', Object.keys(teamAbbreviations).sort());
}

function closeSheetsConfigModal() {
    var modal = document.getElementById('sheetsConfigModal');
    if (modal) {
        modal.remove();
    }
}

function configureWeekGids() {
    var weekGids = {};
    var skipAll = false;
    var currentWeek = 1;
    
    function processNextWeek() {
        if (currentWeek > 18 || skipAll) {
            // Finished configuration
            sheetsConfig.weekGids = weekGids;
            saveSyncSettings();
            console.log('Week GIDs configured:', weekGids);
            return;
        }
        
        var message = 'Enter GID for Week ' + currentWeek + ' sheet:\n\n';
        message += '• Enter GID to configure this week\n';
        message += '• Click "Skip" to skip this week\n';
        message += '• Click "Skip All" to skip remaining weeks\n';
        message += '• Click "Cancel" to stop configuration';
        
        showWeekGidPrompt(message).then(function(result) {
            if (result.action === 'cancel') {
                // User cancelled - finish with current progress
                sheetsConfig.weekGids = weekGids;
                saveSyncSettings();
                console.log('Week GIDs configuration cancelled. Configured:', weekGids);
                return;
            } else if (result.action === 'skipAll') {
                skipAll = true; // Skip remaining weeks
            } else if (result.action === 'enter' && result.gid && result.gid.trim()) {
                weekGids[currentWeek] = result.gid.trim();
            }
            // If action is 'skip', just continue to next week
            
            currentWeek++;
            processNextWeek(); // Process next week
        });
    }
    
    processNextWeek(); // Start the process
}

function showWeekGidPrompt(message) {
    // Create a custom modal for better UX than prompt()
    var modalHtml = `
        <div id="weekGidModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">📋 Configure Week GID</h3>
                <div style="margin-bottom: 20px; color: #666; line-height: 1.5; font-size: 14px;">
                    ${message.replace(/\n/g, '<br>')}
                </div>
                <div style="margin-bottom: 16px;">
                    <input type="text" id="weekGidInput" placeholder="Enter GID (e.g., 1234567890)" 
                           style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button id="skipAllBtn" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                        Skip All
                    </button>
                    <button id="skipBtn" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                        Skip
                    </button>
                    <button id="cancelBtn" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="enterBtn" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer;">
                        Enter
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    var modal = document.getElementById('weekGidModal');
    var input = document.getElementById('weekGidInput');
    var result = { action: 'cancel', gid: '' };
    
    // Focus input
    input.focus();
    
    // Handle Enter key
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            result.action = 'enter';
            result.gid = input.value;
            modal.remove();
        }
    });
    
    // Button click handlers
    document.getElementById('enterBtn').addEventListener('click', function() {
        result.action = 'enter';
        result.gid = input.value;
        modal.remove();
    });
    
    document.getElementById('skipBtn').addEventListener('click', function() {
        result.action = 'skip';
        modal.remove();
    });
    
    document.getElementById('skipAllBtn').addEventListener('click', function() {
        result.action = 'skipAll';
        modal.remove();
    });
    
    document.getElementById('cancelBtn').addEventListener('click', function() {
        result.action = 'cancel';
        modal.remove();
    });
    
    // Close on background click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            result.action = 'cancel';
            modal.remove();
        }
    });
    
    // Return a promise-like object that resolves when modal is closed
    return new Promise(function(resolve) {
        var checkClosed = setInterval(function() {
            if (!document.getElementById('weekGidModal')) {
                clearInterval(checkClosed);
                resolve(result);
            }
        }, 100);
    });
}

function enableAutoSync() {
    if (sheetsConfig.syncInterval) {
        clearInterval(sheetsConfig.syncInterval);
    }
    
    sheetsConfig.autoSyncEnabled = true;
    sheetsConfig.syncInterval = setInterval(syncFromSheets, 5 * 60 * 1000); // 5 minutes
    
    console.log('Auto-sync enabled, interval ID:', sheetsConfig.syncInterval);
    updateSyncStatus();
    showNotification('Auto-sync enabled (every 5 minutes)', 'info');
}

function disableAutoSync() {
    if (sheetsConfig.syncInterval) {
        clearInterval(sheetsConfig.syncInterval);
        sheetsConfig.syncInterval = null;
    }
    
    sheetsConfig.autoSyncEnabled = false;
    updateSyncStatus();
    showNotification('Auto-sync disabled', 'info');
}

function updateSyncStatus() {
    var syncStatus = document.getElementById('syncStatus');
    var syncStatusText = document.getElementById('syncStatusText');
    
    // Check if DOM elements exist
    if (!syncStatus || !syncStatusText) {
        console.log('Sync status elements not found, skipping update');
        return;
    }
    
    if (sheetsConfig.spreadsheetId) {
        syncStatus.style.display = 'block';
        if (sheetsConfig.autoSyncEnabled) {
            syncStatusText.textContent = 'Auto-sync: ON (every 5 min)';
            syncStatusText.style.color = '#10b981';
        } else {
            syncStatusText.textContent = 'Auto-sync: OFF';
            syncStatusText.style.color = '#666';
        }
    } else {
        syncStatus.style.display = 'none';
    }
}

function saveSyncSettings() {
    // Save to localStorage
    localStorage.setItem('sheetsSyncConfig', JSON.stringify({
        spreadsheetId: sheetsConfig.spreadsheetId,
        currentWeekGid: sheetsConfig.currentWeekGid,
        weekGids: sheetsConfig.weekGids,
        autoSyncEnabled: sheetsConfig.autoSyncEnabled
    }));
    
    // Save to Firebase
    if (database) {
        database.ref('sheetsSyncConfig').set({
            spreadsheetId: sheetsConfig.spreadsheetId,
            currentWeekGid: sheetsConfig.currentWeekGid,
            weekGids: sheetsConfig.weekGids,
            autoSyncEnabled: sheetsConfig.autoSyncEnabled
        });
    }
    
    console.log('Sync settings saved to localStorage and Firebase');
}

function loadSyncSettings() {
    // Try to load from localStorage first (faster)
    var savedConfig = localStorage.getItem('sheetsSyncConfig');
    if (savedConfig) {
        try {
            var config = JSON.parse(savedConfig);
            sheetsConfig.spreadsheetId = config.spreadsheetId || '';
            sheetsConfig.currentWeekGid = config.currentWeekGid || '';
            sheetsConfig.weekGids = config.weekGids || {};
            
            // Restore auto-sync if it was enabled
            if (config.autoSyncEnabled) {
                console.log('Restoring auto-sync from localStorage');
                // Add small delay to ensure DOM is ready
                setTimeout(function() {
                    enableAutoSync();
                }, 100);
            }
            
            console.log('Sync settings loaded from localStorage:', config);
            updateSyncStatus();
            
            // Retry updateSyncStatus after DOM is fully loaded
            setTimeout(function() {
                updateSyncStatus();
            }, 200);
            return;
        } catch (e) {
            console.error('Error loading sync settings from localStorage:', e);
        }
    }
    
    // Fallback to Firebase
    if (database) {
        database.ref('sheetsSyncConfig').once('value').then(function(snapshot) {
            var config = snapshot.val();
            if (config) {
                sheetsConfig.spreadsheetId = config.spreadsheetId || '';
                sheetsConfig.currentWeekGid = config.currentWeekGid || '';
                sheetsConfig.weekGids = config.weekGids || {};
                
                // Restore auto-sync if it was enabled
                if (config.autoSyncEnabled) {
                    console.log('Restoring auto-sync from Firebase');
                    // Add small delay to ensure DOM is ready
                    setTimeout(function() {
                        enableAutoSync();
                    }, 100);
                }
                
                // Save to localStorage for future loads
                localStorage.setItem('sheetsSyncConfig', JSON.stringify(config));
                
                console.log('Sync settings loaded from Firebase:', config);
                updateSyncStatus();
                
                // Retry updateSyncStatus after DOM is fully loaded
                setTimeout(function() {
                    updateSyncStatus();
                }, 200);
            }
        }).catch(function(error) {
            console.error('Error loading sync settings from Firebase:', error);
        });
    }
}

function syncFromSheets() {
    if (!sheetsConfig.spreadsheetId) {
        showNotification('Google Sheets not configured', 'error');
        return;
    }
    
    // Determine which GID to use
    var targetGid = sheetsConfig.weekGids[currentWeek] || sheetsConfig.currentWeekGid;
    
    if (!targetGid) {
        showNotification('No GID configured for current week', 'error');
        return;
    }
    
    // Build CSV export URL
    var csvUrl = 'https://docs.google.com/spreadsheets/d/' + sheetsConfig.spreadsheetId + '/export?format=csv&gid=' + targetGid;
    
    console.log('Syncing from Sheets URL:', csvUrl);
    
    fetch(csvUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch spreadsheet data');
            }
            return response.text();
        })
        .then(csvText => {
            var result = parseCSVData(csvText);
            var picks = result.picks || result; // Handle both old and new return format
            var skippedCount = result.skippedCount || 0;
            
            if (picks.length > 0) {
                updatePicksFromSheets(picks);
                var message = 'Synced ' + picks.length + ' picks from Google Sheets';
                if (skippedCount > 0) {
                    message += ' (' + skippedCount + ' invalid players skipped)';
                }
                showNotification(message, 'success');
            } else {
                var message = 'No valid picks found in spreadsheet';
                if (skippedCount > 0) {
                    message += ' (' + skippedCount + ' invalid players skipped)';
                }
                showNotification(message, 'info');
            }
        })
        .catch(error => {
            console.error('Sheets sync error:', error);
            showNotification('Failed to sync from Google Sheets: ' + error.message, 'error');
        });
}

function parseCSVData(csvText) {
    var lines = csvText.split('\n');
    var picks = [];
    var skippedCount = 0;
    var validPlayers = getValidPlayerNames();
    
    // Skip empty lines and find header row
    var headerRow = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() && lines[i].toLowerCase().includes('player') || lines[i].toLowerCase().includes('name')) {
            headerRow = i;
            break;
        }
    }
    
    if (headerRow === -1) {
        console.log('No header row found, using first non-empty row');
        headerRow = 0;
    }
    
    // Parse data rows
    for (var i = headerRow + 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        
        var columns = parseCSVLine(line);
        if (columns.length < 3) continue; // Need at least player name, pick, and odds
        
        console.log('CSV columns for line', i, ':', columns);
        
        var playerName = columns[0] ? columns[0].trim() : '';
        
        // Only process picks for valid players
        if (!isValidPlayerName(playerName, validPlayers)) {
            console.log('Skipping pick for invalid player:', playerName);
            skippedCount++;
            continue;
        }
        
        // Process game abbreviation from column G (index 6)
        var gameAbbreviation = columns[6] ? columns[6].trim().toUpperCase() : '';
        var gameName = '';
        
        // Check all columns to find where game data is stored
        console.log('All columns:', columns);
        for (var colIndex = 0; colIndex < Math.min(columns.length, 10); colIndex++) {
            if (columns[colIndex] && (columns[colIndex].includes(' VS ') || columns[colIndex].includes(' vs ') || columns[colIndex].includes(' @ '))) {
                console.log('Found game data in column', colIndex, ':', columns[colIndex]);
                // Use this column instead of column 6
                if (!gameAbbreviation) {
                    gameAbbreviation = columns[colIndex].trim().toUpperCase();
                    console.log('Using column', colIndex, 'for game abbreviation:', gameAbbreviation);
                }
                break;
            }
        }
        
        console.log('Processing game abbreviation:', gameAbbreviation);
        console.log('Column 6 (G) content:', columns[6]);
        console.log('Total columns:', columns.length);
        
        if (gameAbbreviation && teamAbbreviations[gameAbbreviation]) {
            gameName = teamAbbreviations[gameAbbreviation];
            console.log('Found single team match:', gameName);
        } else if (gameAbbreviation) {
            // If abbreviation not found, try to find a game that contains the abbreviation
            gameName = findGameByAbbreviation(gameAbbreviation);
            console.log('Game name from findGameByAbbreviation:', gameName);
        }
        
        // Don't set timeSlot here - let the manual logic handle it after DOM is rendered
        var pick = {
            playerName: playerName,
            pick: columns[1] ? columns[1].trim() : '',
            odds: columns[2] ? columns[2].trim() : '',
            game: gameName,
            timeSlot: '', // Will be auto-selected by updateTimeSlotFromGame
            timestamp: Date.now(),
            isEditing: false  // Start as read-only, will be set to true temporarily during sync
        };
        
        console.log('Created pick object:', pick);
        
        // Only add if we have essential data and game info (not empty strings)
        if (pick.playerName && pick.pick && pick.pick !== '' && pick.odds && pick.odds !== '' && gameName) {
            picks.push(pick);
            console.log('Added valid pick for', pick.playerName);
        } else {
            console.log('Skipped invalid pick:', pick.playerName, 'Pick:', pick.pick, 'Odds:', pick.odds, 'Game:', gameName);
        }
    }
    
    console.log('Parsed picks from CSV:', picks);
    console.log('Skipped invalid players:', skippedCount);
    
    return {
        picks: picks,
        skippedCount: skippedCount
    };
}

function getValidPlayerNames() {
    var validPlayers = [];
    
    // Add predefined player names
    validPlayers = validPlayers.concat(playerNames);
    
    // Add any existing player names from current week picks
    if (weeklyPicks[currentWeek]) {
        weeklyPicks[currentWeek].forEach(function(pick) {
            if (pick && pick.playerName && validPlayers.indexOf(pick.playerName) === -1) {
                validPlayers.push(pick.playerName);
            }
        });
    }
    
    // Add any existing player names from other weeks
    for (var week in weeklyPicks) {
        if (weeklyPicks[week]) {
            weeklyPicks[week].forEach(function(pick) {
                if (pick && pick.playerName && validPlayers.indexOf(pick.playerName) === -1) {
                    validPlayers.push(pick.playerName);
                }
            });
        }
    }
    
    console.log('Valid player names:', validPlayers);
    return validPlayers;
}

function isValidPlayerName(playerName, validPlayers) {
    if (!playerName) return false;
    
    // Check exact match first
    if (validPlayers.indexOf(playerName) !== -1) {
        return true;
    }
    
    // Check case-insensitive match
    for (var i = 0; i < validPlayers.length; i++) {
        if (validPlayers[i].toLowerCase() === playerName.toLowerCase()) {
            return true;
        }
    }
    
    return false;
}

function findGameByAbbreviation(abbreviation) {
    // Handle "TEAM1 VS TEAM2" format
    if (abbreviation.includes(' VS ') || abbreviation.includes(' vs ') || abbreviation.includes(' @ ')) {
        var parts = abbreviation.split(/ VS | vs | @ /i);
        if (parts.length === 2) {
            var team1 = parts[0].trim().toUpperCase();
            var team2 = parts[1].trim().toUpperCase();
            
            // Get available games for current week
            var gameSelect = document.getElementById('game' + 0);
            if (!gameSelect) return abbreviation;
            
            var options = gameSelect.options;
            for (var i = 0; i < options.length; i++) {
                var gameName = options[i].value;
                if (gameName) {
                    // Check if both team full names are in the game name
                    var gameUpper = gameName.toUpperCase();
                    var team1FullName = teamAbbreviations[team1] ? teamAbbreviations[team1].toUpperCase() : '';
                    var team2FullName = teamAbbreviations[team2] ? teamAbbreviations[team2].toUpperCase() : '';
                    
                    // Both teams must be present in the game name (order doesn't matter)
                    if (team1FullName && team2FullName && 
                        gameUpper.includes(team1FullName) && gameUpper.includes(team2FullName)) {
                        console.log('Found game match:', gameName, 'for abbreviations:', team1, 'vs', team2);
                        return gameName;
                    }
                }
            }
        }
    }
    
    // Handle single team abbreviation
    if (teamAbbreviations[abbreviation]) {
        var teamName = teamAbbreviations[abbreviation];
        
        // Get available games for current week
        var gameSelect = document.getElementById('game' + 0);
        if (!gameSelect) return teamName;
        
        var options = gameSelect.options;
        for (var i = 0; i < options.length; i++) {
            var gameName = options[i].value;
            if (gameName && gameName.includes(teamName)) {
                return gameName;
            }
        }
    }
    
    // If not found, try partial matching in game names
    var gameSelect = document.getElementById('game' + 0);
    if (!gameSelect) return abbreviation;
    
    var options = gameSelect.options;
    for (var i = 0; i < options.length; i++) {
        var gameName = options[i].value;
        if (gameName && gameName.toUpperCase().includes(abbreviation)) {
            return gameName;
        }
    }
    
    // If still not found, return the abbreviation as-is
    console.log('Game not found for abbreviation:', abbreviation);
    return abbreviation;
}

function parseCSVLine(line) {
    var columns = [];
    var current = '';
    var inQuotes = false;
    
    for (var i = 0; i < line.length; i++) {
        var char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            columns.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    columns.push(current);
    return columns;
}

function updatePicksFromSheets(sheetsPicks) {
    if (!weeklyPicks[currentWeek]) {
        weeklyPicks[currentWeek] = [];
    }
    
    // Ensure we have enough slots for the numberOfLegs
    var numberOfLegs = parseInt(document.getElementById('numberOfLegs').value) || 20;
    while (weeklyPicks[currentWeek].length < numberOfLegs) {
        weeklyPicks[currentWeek].push(null);
    }
    
    // Only pre-populate slots for players that have valid picks in the spreadsheet
    console.log('=== NEW PRE-POPULATION LOGIC ===');
    var validPlayerNames = sheetsPicks.map(function(pick) { return pick.playerName.toLowerCase().trim(); });
    console.log('Valid player names from sheets:', validPlayerNames);
    
    for (var i = 0; i < Math.min(playerNames.length, numberOfLegs); i++) {
        var currentPlayerName = playerNames[i].toLowerCase().trim();
        var hasValidPick = validPlayerNames.includes(currentPlayerName);
        
        // Only pre-populate if this player has a valid pick in the spreadsheet
        if (!weeklyPicks[currentWeek][i] && hasValidPick) {
            weeklyPicks[currentWeek][i] = {
                playerName: playerNames[i],
                pick: 'TBD',
                odds: 'TBD',
                game: 'TBD',
                timeSlot: 'TBD',
                result: null,
                timestamp: Date.now(),
                isSGP: false,
                sgpOdds: '',  // Empty string instead of null to satisfy Firebase rules
                isEditing: false
            };
            console.log('Pre-populated slot', i, 'with player:', playerNames[i], '(has valid spreadsheet pick)');
        } else if (!weeklyPicks[currentWeek][i]) {
            // Keep as null for players without valid picks
            console.log('Leaving slot', i, 'empty for player:', playerNames[i], '(no valid spreadsheet pick)');
        }
    }
    
    console.log('updatePicksFromSheets called with', sheetsPicks.length, 'picks');
    console.log('Current week:', currentWeek);
    console.log('Number of legs:', numberOfLegs);
    console.log('Current weeklyPicks array length:', weeklyPicks[currentWeek].length);
    console.log('Current weeklyPicks array:', weeklyPicks[currentWeek]);
    console.log('Sheets picks:', sheetsPicks);
    
    var updatedCount = 0;
    var addedCount = 0;
    
    // First, mark all existing picks as "not found in spreadsheet"
    var syncedPlayerNames = sheetsPicks.map(function(pick) {
        return pick.playerName.trim().toLowerCase();
    });
    
    // Track which players have picks in the spreadsheet
    var playersWithSheetPicks = {};
    sheetsPicks.forEach(function(sheetPick) {
        playersWithSheetPicks[sheetPick.playerName.trim().toLowerCase()] = sheetPick;
    });
    
    sheetsPicks.forEach(function(sheetsPick, index) {
        console.log('Processing sheet pick for player:', sheetsPick.playerName, 'at array index:', index);
        
        // Find existing slot with matching player name
        var existingPickIndex = -1;
        for (var i = 0; i < weeklyPicks[currentWeek].length; i++) {
            var existingPick = weeklyPicks[currentWeek][i];
            if (existingPick && existingPick.playerName) {
                var existingName = existingPick.playerName.trim().toLowerCase();
                var sheetName = sheetsPick.playerName.trim().toLowerCase();
                console.log('Checking slot', i, ':', existingPick.playerName, '(comparing', existingName, 'vs', sheetName, ')');
                if (existingName === sheetName) {
                    existingPickIndex = i;
                    console.log('Found existing slot at', i, 'for player', sheetsPick.playerName);
                    break;
                }
            } else {
                console.log('Checking slot', i, ': null or no player name');
            }
        }
        
        // If no matching player found, skip this pick - don't create new slots
        if (existingPickIndex === -1) {
            console.log('Player', sheetsPick.playerName, 'not found in existing slots - skipping (player not on website)');
            return;
        }
        
        // Update the existing slot with the synced data
        var oldPick = weeklyPicks[currentWeek][existingPickIndex];
        var hasExistingData = oldPick && oldPick.pick && oldPick.pick !== 'No pick';
        
        // Get the correct time slot for this game
        var correctTimeSlot = getTimeSlotFromGame(sheetsPick.game);
        
        // Use the new data from sheets, but preserve timestamp if updating
        var newPick = {
            playerName: sheetsPick.playerName,
            pick: sheetsPick.pick,
            odds: sheetsPick.odds,
            game: sheetsPick.game,
            timeSlot: correctTimeSlot,
            timestamp: (oldPick && oldPick.timestamp) ? oldPick.timestamp : Date.now(),
            isEditing: false  // Start as read-only
        };
        
        weeklyPicks[currentWeek][existingPickIndex] = newPick;
        
        if (hasExistingData) {
            updatedCount++;
            logAuditEntry(currentWeek, 'Updated pick from Google Sheets', sheetsPick.playerName + ': ' + sheetsPick.pick);
            console.log('Updated existing pick for', sheetsPick.playerName, 'at slot', existingPickIndex);
        } else {
            addedCount++;
            logAuditEntry(currentWeek, 'Added pick from Google Sheets', sheetsPick.playerName + ': ' + sheetsPick.pick);
            console.log('Filled empty slot for', sheetsPick.playerName, 'at slot', existingPickIndex);
        }
    });
    
    // Clear picks for players who are no longer in the spreadsheet
    var clearedCount = 0;
    for (var i = 0; i < weeklyPicks[currentWeek].length; i++) {
        var existingPick = weeklyPicks[currentWeek][i];
        if (existingPick && existingPick.playerName) {
            var existingName = existingPick.playerName.trim().toLowerCase();
            var hasPickInSheets = playersWithSheetPicks[existingName];
            
            // If this player is not in the spreadsheet, clear their pick
            if (!hasPickInSheets) {
                // Only clear if it's not a placeholder pick
                if (existingPick.pick && existingPick.pick !== 'TBD' && existingPick.pick !== '' && 
                    existingPick.odds && existingPick.odds !== 'TBD' && existingPick.odds !== '') {
                    
                    weeklyPicks[currentWeek][i] = {
                        playerName: existingPick.playerName,
                        pick: 'TBD',
                        odds: 'TBD',
                        game: 'TBD',
                        timeSlot: 'TBD',
                        result: null,
                        timestamp: Date.now(),
                        isSGP: false,
                        sgpOdds: '',  // Empty string instead of null to satisfy Firebase rules
                        isEditing: false  // Set to submitted state to avoid Cancel button
                    };
                    clearedCount++;
                    logAuditEntry(currentWeek, 'Cleared pick (removed from spreadsheet)', existingPick.playerName);
                    console.log('Cleared pick for', existingPick.playerName, 'at slot', i, '(removed from spreadsheet)');
                }
            }
        }
    }
    
    if (updatedCount > 0 || addedCount > 0 || clearedCount > 0) {
        console.log('Sync completed - Updated:', updatedCount, 'Added:', addedCount);
        console.log('Final weeklyPicks array length:', weeklyPicks[currentWeek].length);
        
        saveToFirebase();
        renderAllPicks();
        updateCalculations();
        updateParlayStatus();
        
        var message = '';
        if (addedCount > 0) message += 'Added ' + addedCount + ' picks. ';
        if (updatedCount > 0) message += 'Updated ' + updatedCount + ' picks. ';
        if (clearedCount > 0) message += 'Cleared ' + clearedCount + ' picks. ';
        showNotification(message, 'success');
    }
}

function toggleAutoSync() {
    if (sheetsConfig.autoSyncEnabled) {
        disableAutoSync();
    } else {
        if (!sheetsConfig.spreadsheetId) {
            showNotification('Please configure Google Sheets sync first', 'error');
            return;
        }
        enableAutoSync();
    }
}

function hideAdminDropdown() {
    var menu = document.getElementById('adminMenu');
    menu.style.display = 'none';
}

function removeSheetsSync() {
    if (!sheetsConfig.spreadsheetId) {
        showNotification('No Google Sheets sync configured', 'info');
        return;
    }
    
    if (confirm('Are you sure you want to remove Google Sheets sync?\n\nThis will:\n• Clear all sync configuration\n• Disable auto-sync\n• Remove sync status indicator\n\nYou can reconfigure it later if needed.')) {
        performRemoveSync();
    }
}

function removeSheetsSyncFromModal() {
    if (confirm('Are you sure you want to remove Google Sheets sync?\n\nThis will:\n• Clear all sync configuration\n• Disable auto-sync\n• Remove sync status indicator\n\nYou can reconfigure it later if needed.')) {
        performRemoveSync();
        closeSheetsConfigModal();
    }
}

function performRemoveSync() {
    // Disable auto-sync first
    disableAutoSync();
    
    // Clear configuration
    sheetsConfig.spreadsheetId = '';
    sheetsConfig.currentWeekGid = '';
    sheetsConfig.weekGids = {};
    sheetsConfig.syncInterval = null;
    sheetsConfig.autoSyncEnabled = false;
    
    // Remove from localStorage and Firebase
    localStorage.removeItem('sheetsSyncConfig');
    if (database) {
        database.ref('sheetsSyncConfig').remove();
    }
    
    // Update UI
    updateSyncStatus();
    
    showNotification('Google Sheets sync removed successfully', 'success');
    console.log('Sheets sync removed. Configuration cleared:', sheetsConfig);
}

function updateBetCalculations() {
var betAmount = betAmounts[currentWeek] || 24;

// Update the input field to show current bet amount
document.getElementById('betAmount').value = betAmount;

var picks = weeklyPicks[currentWeek] || [];
var activePicks = picks.filter(function(p) { 
    return p && p.result !== 'draw' && p.pick && p.pick !== 'TBD' && p.pick !== '' && p.odds && p.odds !== 'TBD' && p.odds !== ''; 
});

if (activePicks.length === 0) {
document.getElementById('totalOddsDisplay').textContent = '+0';
            document.getElementById('totalPayoutDisplay').textContent = formatCurrency(0);
return;
}

var totalOdds = 1;
var gameGroups = {};
var processedGames = {};

// Count active picks per game
activePicks.forEach(function(pick) {
if (pick.game && pick.game !== 'No game') {
if (!gameGroups[pick.game]) {
gameGroups[pick.game] = [];
}
gameGroups[pick.game].push(pick);
}
});

// Calculate total odds
activePicks.forEach(function(pick) {
var activeLegsForGame = gameGroups[pick.game] ? gameGroups[pick.game].length : 1;

// If this was an SGP but now only has 1 active leg, treat as individual bet
if (pick.isSGP && activeLegsForGame === 1) {
totalOdds *= americanToDecimal(pick.odds);
}
// If it's an SGP with 2+ active legs, use SGP odds (only once per game)
else if (pick.isSGP && pick.sgpOdds && activeLegsForGame >= 2) {
if (!processedGames[pick.game]) {
processedGames[pick.game] = true;
totalOdds *= americanToDecimal(pick.sgpOdds);
}
}
// Individual bets (not SGP)
else if (!pick.isSGP) {
totalOdds *= americanToDecimal(pick.odds);
}
});

var totalPayout = betAmount * totalOdds;
var americanOdds = decimalToAmerican(totalOdds);

document.getElementById('totalOddsDisplay').textContent = americanOdds;
            document.getElementById('totalPayoutDisplay').textContent = formatCurrency(totalPayout);

// Update summary page if we're on it
updateSummaryBetInfo();
}

function updateSummaryBetInfo() {
var betAmount = betAmounts[currentWeek] || 24;

            // Update summary bet amount display (read-only)
            document.getElementById('summaryBetAmountDisplay').textContent = formatCurrency(betAmount);
            
            // Update the bet amount card in the summary stats
            document.getElementById('summaryBetAmountCard').textContent = formatCurrency(betAmount);

var picks = weeklyPicks[currentWeek] || [];
var activePicks = picks.filter(function(p) { 
    return p && p.result !== 'draw' && p.pick && p.pick !== 'TBD' && p.pick !== '' && p.odds && p.odds !== 'TBD' && p.odds !== ''; 
});

if (activePicks.length === 0) {
document.getElementById('summaryTotalOdds').textContent = '+0';
                document.getElementById('summaryTotalPayout').textContent = formatCurrency(0);
return;
}

var totalOdds = 1;
var gameGroups = {};
var processedGames = {};

// Count active picks per game
activePicks.forEach(function(pick) {
if (pick.game && pick.game !== 'No game') {
if (!gameGroups[pick.game]) {
gameGroups[pick.game] = [];
}
gameGroups[pick.game].push(pick);
}
});

// Calculate total odds
activePicks.forEach(function(pick) {
var activeLegsForGame = gameGroups[pick.game] ? gameGroups[pick.game].length : 1;

// If this was an SGP but now only has 1 active leg, treat as individual bet
if (pick.isSGP && activeLegsForGame === 1) {
totalOdds *= americanToDecimal(pick.odds);
}
// If it's an SGP with 2+ active legs, use SGP odds (only once per game)
else if (pick.isSGP && pick.sgpOdds && activeLegsForGame >= 2) {
if (!processedGames[pick.game]) {
processedGames[pick.game] = true;
totalOdds *= americanToDecimal(pick.sgpOdds);
}
}
// Individual bets (not SGP)
else if (!pick.isSGP) {
totalOdds *= americanToDecimal(pick.odds);
}
});

var totalPayout = betAmount * totalOdds;
var americanOdds = decimalToAmerican(totalOdds);

document.getElementById('summaryTotalOdds').textContent = americanOdds;
            document.getElementById('summaryTotalPayout').textContent = formatCurrency(totalPayout);
}


function updateCalculations() {
// Call the new bet calculation function
updateBetCalculations();

var picks = weeklyPicks[currentWeek] || [];
var betAmount = parseFloat(document.getElementById('betAmount') ? document.getElementById('betAmount').value : 24) || 24;

var activePicks = picks.filter(function(p) { 
    return p && p.result !== 'draw' && p.pick && p.pick !== 'TBD' && p.pick !== '' && p.odds && p.odds !== 'TBD' && p.odds !== ''; 
});

var totalOdds = 1;
var gameGroups = {};
var processedGames = {};

// First, count active picks per game
var gamePickCounts = {};
activePicks.forEach(function(pick) {
if (pick.game && pick.game !== 'No game') {
gamePickCounts[pick.game] = (gamePickCounts[pick.game] || 0) + 1;
}
});

activePicks.forEach(function(pick) {
var activeLegsForGame = pick.game ? gamePickCounts[pick.game] : 0;

// If this was an SGP but now only has 1 active leg, treat as individual bet
if (pick.isSGP && activeLegsForGame === 1) {
totalOdds *= americanToDecimal(pick.odds);
}
// If it's an SGP with 2+ active legs, use SGP odds (only once per game)
else if (pick.isSGP && pick.sgpOdds && activeLegsForGame >= 2) {
if (!processedGames[pick.game]) {
processedGames[pick.game] = true;
totalOdds *= americanToDecimal(pick.sgpOdds);
}
}
// Individual bets (not SGP)
else if (!pick.isSGP) {
totalOdds *= americanToDecimal(pick.odds);
}
});

var americanOdds = decimalToAmerican(totalOdds);
var potentialWinnings = betAmount * totalOdds;
var taxes = potentialWinnings * 0.3;
var netWinnings = potentialWinnings - taxes;
var perPerson = activePicks.length > 0 ? netWinnings / activePicks.length : 0;

document.getElementById('totalOdds').textContent = americanOdds;
            document.getElementById('totalPicks').textContent = formatNumber(picks.filter(function(p) { return p; }).length);
            document.getElementById('betAmount').textContent = formatCurrency(betAmount);
            document.getElementById('potentialWinnings').textContent = formatCurrency(potentialWinnings);
            document.getElementById('taxes').textContent = formatCurrency(taxes);
            document.getElementById('netWinnings').textContent = formatCurrency(netWinnings);
            document.getElementById('perPerson').textContent = formatCurrency(perPerson);

updatePicksSummary();
}

function updateParlayStatus() {
var picks = weeklyPicks[currentWeek] || [];

// Ensure picks is always an array
if (!Array.isArray(picks)) {
picks = [];
weeklyPicks[currentWeek] = picks;
}

var statusElement = document.getElementById('parlayStatus');
var iconElement = document.getElementById('parlayStatusIcon');
var textElement = document.getElementById('parlayStatusText');

if (!statusElement || !iconElement || !textElement) return;

// Filter out null picks and draws (voided picks)
var activePicks = picks.filter(function(pick) {
return pick && pick.result !== 'draw' && pick.pick && pick.pick !== 'TBD' && pick.pick !== '' && pick.odds && pick.odds !== 'TBD' && pick.odds !== '';
});

// Check if any pick has lost (result === false)
var hasLoss = activePicks.some(function(pick) {
return pick.result === false;
});

if (hasLoss) {
// Parlay is dead
statusElement.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
iconElement.textContent = '💀';
textElement.textContent = 'Parlay Dead';
} else {
// Parlay is still alive (all picks are pending, won, or voided)
statusElement.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
iconElement.textContent = '💚';
textElement.textContent = 'Parlay Still Alive';
}
}

function getTimeSlotOrder(timeSlot) {
// Define chronological order of time slots
var timeOrder = {
'TNF': 1,    // Thursday Night Football
'Early': 2,   // Early Sunday games
'Late': 3,    // Late Sunday games  
'SNF': 4,     // Sunday Night Football
'MNF': 5      // Monday Night Football
};
return timeOrder[timeSlot] || 999; // Unknown time slots go to end
}

function getTimeSlotDisplayName(timeSlot) {
var displayNames = {
'TNF': 'Thursday Night Football',
'Early': 'Early Sunday Games (1:00 PM ET)',
'Late': 'Late Sunday Games (4:25 PM ET)',
'SNF': 'Sunday Night Football (8:20 PM ET)',
'MNF': 'Monday Night Football (8:15 PM ET)'
};
return displayNames[timeSlot] || 'Unknown Time Slot';
}

function updatePicksSummary() {
var picks = weeklyPicks[currentWeek] || [];

// Ensure picks is always an array
if (!Array.isArray(picks)) {
picks = [];
weeklyPicks[currentWeek] = picks;
}

var container = document.getElementById('picksSummary');

if (!container) return;

if (picks.filter(function(p) { return p; }).length === 0) {
container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No picks saved for this week</p>';
return;
}

var gameGroups = {};
var individualPicks = [];

picks.forEach(function(pick) {
if (!pick) return;

if (pick.game && pick.game !== 'No game') {
if (!gameGroups[pick.game]) {
gameGroups[pick.game] = [];
}
gameGroups[pick.game].push(pick);
} else {
individualPicks.push(pick);
}
});

// Sort game groups by time slot (earliest first)
var sortedGames = Object.keys(gameGroups).sort(function(a, b) {
var gameA = gameGroups[a][0]; // Get first pick from group to determine time slot
var gameB = gameGroups[b][0];
var timeOrderA = getTimeSlotOrder(gameA.timeSlot);
var timeOrderB = getTimeSlotOrder(gameB.timeSlot);

if (timeOrderA !== timeOrderB) {
return timeOrderA - timeOrderB;
}

// If same time slot, sort alphabetically by game name
return a.localeCompare(b);
});

// Sort individual picks by time slot
individualPicks.sort(function(a, b) {
var timeOrderA = getTimeSlotOrder(a.timeSlot);
var timeOrderB = getTimeSlotOrder(b.timeSlot);

if (timeOrderA !== timeOrderB) {
return timeOrderA - timeOrderB;
}

// If same time slot, sort by player name
return (a.playerName || '').localeCompare(b.playerName || '');
});

var html = '';

// Combine all picks (SGP groups and individual) and sort by time slot
var allPicksByTimeSlot = {};

// Process all game groups - SGP groups (2+ picks) and individual picks (1 pick)
for (var game in gameGroups) {
var gamePicks = gameGroups[game];
var firstPick = gamePicks[0];
var timeSlot = firstPick.timeSlot || 'Unknown';

if (!allPicksByTimeSlot[timeSlot]) {
allPicksByTimeSlot[timeSlot] = [];
}

if (gamePicks.length >= 2) {
// This is an SGP group
allPicksByTimeSlot[timeSlot].push({
type: 'sgp',
game: game,
picks: gamePicks
});
} else {
// This is a single pick - treat as individual
allPicksByTimeSlot[timeSlot].push({
type: 'individual',
pick: firstPick
});
}
}

// Add individual picks that don't have a game assigned
individualPicks.forEach(function(pick) {
var timeSlot = pick.timeSlot || 'Unknown';
if (!allPicksByTimeSlot[timeSlot]) {
allPicksByTimeSlot[timeSlot] = [];
}
allPicksByTimeSlot[timeSlot].push({
type: 'individual',
pick: pick
});
});

// Sort time slots chronologically
var sortedTimeSlots = Object.keys(allPicksByTimeSlot).sort(function(a, b) {
return getTimeSlotOrder(a) - getTimeSlotOrder(b);
});

var html = '';

// Display picks grouped by time slot
sortedTimeSlots.forEach(function(timeSlot) {
var picksInSlot = allPicksByTimeSlot[timeSlot];

// Add time slot header
html += '<div style="margin-bottom: 16px;">';
html += '<h4 style="color: #666; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; padding: 8px 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid #3b82f6;">' + 
getTimeSlotDisplayName(timeSlot) + '</h4>';

// Display all picks in this time slot
picksInSlot.forEach(function(item) {
if (item.type === 'sgp') {
var game = item.game;
var gamePicks = item.picks;
var firstPick = gamePicks[0];
if (gamePicks.length >= 2) {
var activeLegs = gamePicks.filter(function(p) { return p.result !== 'draw'; });
var hasOnlyOneLeg = activeLegs.length === 1;
var sgpOdds = gamePicks[0].sgpOdds || 'Not Set';

var status = 'Pending';
var statusColor = '#757575';
var results = gamePicks.map(function(p) { return p.result; });

if (results.every(function(r) { return r === true; })) {
status = 'Win';
statusColor = '#4CAF50';
} else if (results.some(function(r) { return r === false; })) {
status = 'Loss';
statusColor = '#f44336';
} else if (results.some(function(r) { return r === 'draw'; })) {
status = 'Draw';
statusColor = '#FF9800';
}

html += '<div style="border: 2px solid #FF9800; border-radius: 8px; padding: 12px; background: rgba(255, 152, 0, 0.05);">';
html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
html += '<strong style="color: #FF9800;">🎯 SGP: ' + game + (hasOnlyOneLeg ? ' (Single)' : '') + '</strong>';
html += '<span style="background: ' + statusColor + '; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">' + status + '</span>';
html += '</div>';

if (!hasOnlyOneLeg) {
html += '<div style="font-weight: bold; color: #FF9800; margin-bottom: 8px;">Odds: ' + sgpOdds + '</div>';
}

gamePicks.forEach(function(pick) {
var isVoided = pick.result === 'draw';
var textStyle = isVoided ? 'text-decoration: line-through; opacity: 0.5;' : '';
var oddsToShow = pick.odds;

html += '<div style="' + textStyle + 'padding: 4px 0; font-size: 14px;">';
html += '• <strong>' + pick.playerName + ':</strong> ' + pick.pick;
if (hasOnlyOneLeg && !isVoided) {
html += ' @ <strong>' + oddsToShow + '</strong>';
}
if (isVoided) {
html += ' <span style="color: #FF9800; font-weight: bold;">[VOIDED]</span>';
}
html += '</div>';
});

html += '</div>';
}
} else if (item.type === 'individual') {
var pick = item.pick;
var status = 'Pending';
var statusColor = '#757575';

if (pick.result === true) {
status = 'Win';
statusColor = '#4CAF50';
} else if (pick.result === false) {
status = 'Loss';
statusColor = '#f44336';
} else if (pick.result === 'draw') {
status = 'Voided';
statusColor = '#FF9800';
}

var textStyle = pick.result === 'draw' ? 'text-decoration: line-through; opacity: 0.5;' : '';

html += '<div style="border: 2px solid #e0e0e0; border-radius: 8px; padding: 12px; background: white; margin-bottom: 8px; ' + textStyle + '">';
html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
html += '<div>';
html += '<strong>' + pick.playerName + ':</strong> ' + pick.pick;
html += '<div style="color: #666; font-size: 13px; margin-top: 4px;">';
html += pick.game ? pick.game : 'No game selected';
html += ' • <strong>' + pick.odds + '</strong>';
html += '</div>';
html += '</div>';
html += '<span style="background: ' + statusColor + '; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">' + status + '</span>';
html += '</div>';
html += '</div>';
}
});

html += '</div>'; // Close time slot group
});

container.innerHTML = html;

// Update parlay status after updating picks summary
updateParlayStatus();
}

function updateLeaderboardData() {
leaderboardData = {};

for (var week in weeklyPicks) {
if (!weeklyPicks[week]) continue;

// Ensure weeklyPicks[week] is an array
if (!Array.isArray(weeklyPicks[week])) {
weeklyPicks[week] = [];
continue;
}

weeklyPicks[week].forEach(function(pick) {
if (!pick) return;
if (!leaderboardData[pick.playerName]) {
leaderboardData[pick.playerName] = {
wins: 0,
losses: 0,
draws: 0
};
}

if (pick.result === true) leaderboardData[pick.playerName].wins++;
else if (pick.result === false) leaderboardData[pick.playerName].losses++;
else if (pick.result === 'draw') leaderboardData[pick.playerName].draws++;
});
}

updateLeaderboard();
}

function updateLeaderboard() {
var tbody = document.getElementById('leaderboardBody');
tbody.innerHTML = '';

var players = [];
for (var name in leaderboardData) {
var data = leaderboardData[name];
var total = data.wins + data.losses + data.draws;
var winRate = total > 0 ? (data.wins / total) : 0;

players.push({
name: name,
wins: data.wins,
losses: data.losses,
draws: data.draws,
winRate: winRate
});
}

players.sort(function(a, b) {
return b.winRate - a.winRate || b.wins - a.wins;
});

if (players.length === 0) {
tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: #666;">No data available</td></tr>';
return;
}

players.forEach(function(player, index) {
var row = document.createElement('tr');
row.innerHTML =
'<td>' + (index + 1) + '</td>' +
'<td>' + player.name + '</td>' +
'<td style="color: #4CAF50; font-weight: bold;">' + player.wins + '</td>' +
'<td style="color: #f44336; font-weight: bold;">' + player.losses + '</td>' +
'<td style="color: #FF9800; font-weight: bold;">' + player.draws + '</td>' +
'<td>' + player.winRate.toFixed(3) + '</td>';
tbody.appendChild(row);
});
}

function switchTab(tabName, clickedButton) {
var tabs = document.querySelectorAll('.tab');
for (var i = 0; i < tabs.length; i++) {
tabs[i].classList.remove('active');
}
var panes = document.querySelectorAll('.tab-pane');
for (var i = 0; i < panes.length; i++) {
panes[i].classList.remove('active');
}

clickedButton.classList.add('active');
document.getElementById(tabName).classList.add('active');

if (tabName === 'summary') {
updateCalculations();
} else if (tabName === 'leaderboard') {
updateLeaderboard();
}
}

function convertOdds() {
var american = parseFloat(document.getElementById('americanOdds').value);
if (!isNaN(american)) {
var decimal;
if (american > 0) {
decimal = (american / 100) + 1;
} else {
decimal = (100 / Math.abs(american)) + 1;
}
document.getElementById('decimalOdds').value = decimal.toFixed(2);

var impliedProb = american > 0 ? 
(100 / (american + 100)) * 100 : 
(Math.abs(american) / (Math.abs(american) + 100)) * 100;
document.getElementById('impliedProb').value = impliedProb.toFixed(1) + '%';
}
}

function convertFromDecimal() {
var decimal = parseFloat(document.getElementById('decimalOdds').value);
if (!isNaN(decimal) && decimal > 1) {
var american;
if (decimal >= 2) {
american = '+' + Math.round((decimal - 1) * 100);
} else {
american = '-' + Math.round(100 / (decimal - 1));
}
document.getElementById('americanOdds').value = american;

var impliedProb = (1 / decimal) * 100;
document.getElementById('impliedProb').value = impliedProb.toFixed(1) + '%';
}
}

function clearIndividualPick(index) {
    if (!confirm('⚠️ Are you sure you want to delete this pick?\n\nThis action cannot be undone.')) {
        return;
    }
    
    // Create backup before destructive action
    createBackupBeforeAction(currentWeek);
    
    if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
        // Log audit entry before clearing
        var pick = weeklyPicks[currentWeek][index];
        var details = pick.playerName + ': ' + pick.pick + ' (' + pick.odds + ') - ' + pick.game;
        logAuditEntry(currentWeek, 'Deleted pick', details);
        
        // Clear the pick completely
        weeklyPicks[currentWeek][index] = null;

        // Save to Firebase
        saveToFirebase();

        showNotification('Pick deleted successfully!', 'success');
        updateCalculations();
        renderAllPicks();
    } else {
        showNotification('No pick to clear at this position.', 'info');
    }
}

function clearAllPicks() {
    if (!confirm('⚠️ WARNING: This will delete ALL picks for Week ' + currentWeek + '!\n\nThis action cannot be undone.\n\nAre you sure you want to continue?')) {
        return;
    }
    
    if (!confirm('🚨 FINAL WARNING: You are about to permanently delete all picks for Week ' + currentWeek + '!\n\nClick OK only if you are absolutely certain.')) {
        return;
    }
    
    // Create backup before destructive action
    createBackupBeforeAction(currentWeek);
    
    // Log audit entry
    var pickCount = weeklyPicks[currentWeek] ? weeklyPicks[currentWeek].filter(p => p !== null).length : 0;
    logAuditEntry(currentWeek, 'Cleared all picks', 'Deleted ' + pickCount + ' picks');
    
    weeklyPicks[currentWeek] = [];
    saveToFirebase();
    renderAllPicks();
    updateCalculations();
    updateParlayStatus();
    showNotification('All picks cleared for Week ' + currentWeek, 'info');
}


function editSGPPick(index) {
// Use the new editing system - mark as editing and re-render
if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
weeklyPicks[currentWeek][index].isEditing = true;
renderAllPicks();
}
}

function formatEditOdds(index) {
var oddsInput = document.getElementById('editOdds' + index);
if (!oddsInput) return;

var oddsValue = oddsInput.value.trim();
if (!oddsValue) return;

var cleanOdds = oddsValue.replace(/[+-]/g, '');
if (isNaN(cleanOdds) || cleanOdds === '') return;

var numericOdds = parseInt(cleanOdds);

if (!oddsValue.includes('+') && !oddsValue.includes('-')) {
if (numericOdds >= 100) {
oddsInput.value = '+' + numericOdds;
} else {
oddsInput.value = '-' + numericOdds;
}
} else if (oddsValue.startsWith('+') || oddsValue.startsWith('-')) {
oddsInput.value = oddsValue.charAt(0) + numericOdds;
}
}

function updateEditTimeSlot(index) {
var gameSelect = document.getElementById('editGame' + index);
var timeSlotSelect = document.getElementById('editTimeSlot' + index);

if (!gameSelect || !timeSlotSelect) return;

var selectedGame = gameSelect.value;
if (!selectedGame) return;

var schedule = nflSchedule[currentNFLWeek] || [];
var game = schedule.find(function(g) {
return g.matchup === selectedGame;
});

if (game) {
timeSlotSelect.value = game.time;
}
}

function saveEditedSGPPick(index) {
var pick = document.getElementById('editPick' + index).value.trim();
var odds = document.getElementById('editOdds' + index).value.trim();
var game = document.getElementById('editGame' + index).value;
var timeSlot = document.getElementById('editTimeSlot' + index).value;

if (!pick || !odds) {
alert('Please fill in Pick and Odds before saving.');
return;
}

// Update the pick
weeklyPicks[currentWeek][index].pick = pick;
weeklyPicks[currentWeek][index].odds = odds;
weeklyPicks[currentWeek][index].game = game;
weeklyPicks[currentWeek][index].timeSlot = timeSlot;
weeklyPicks[currentWeek][index].isSGP = false; // Remove from SGP first
weeklyPicks[currentWeek][index].sgpOdds = null;

showNotification('✓ Pick updated successfully!', 'success');
checkForSGPs();
updateCalculations();
renderAllPicks();
}

function removeSGPPick(index) {
console.log('removeSGPPick called with index:', index);

if (weeklyPicks[currentWeek] && weeklyPicks[currentWeek][index]) {
console.log('Pick exists, clearing...');
// Clear the pick completely
weeklyPicks[currentWeek][index] = null;

console.log('Pick cleared, showing notification and refreshing...');
showNotification('Pick removed successfully!', 'success');
updateCalculations();
renderAllPicks();
} else {
console.log('Pick does not exist or is already null');
}
}

function resetLeaderboard() {
if (confirm('Are you sure you want to reset all season stats? This cannot be undone.')) {
leaderboardData = {};
weeklyPicks = {};
renderAllPicks();
updateCalculations();
updateLeaderboard();
}
}
