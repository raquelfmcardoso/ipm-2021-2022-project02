// Bakeoff #2 - Seleção de Alvos Fora de Alcance
// IPM 2021-22, Período 3
// Entrega: até dia 22 de Abril às 23h59 através do Fenix
// Bake-off: durante os laboratórios da semana de 18 de Abril

// p5.js reference: https://p5js.org/reference/

// Database (CHANGE THESE!)
const GROUP_NUMBER   = "44-AL";      // Add your group number here as an integer (e.g., 2, 3)
const BAKE_OFF_DAY   = false;  // Set to 'true' before sharing during the bake-off day

// Target and grid properties (DO NOT CHANGE!)
let PPI, PPCM;
let TARGET_SIZE;
let TARGET_PADDING, MARGIN, LEFT_PADDING, TOP_PADDING;
let continue_button;
let inputArea        = {x: 0, y: 0, h: 0, w: 0}    // Position and size of the user input area

// Metrics
let testStartTime, testEndTime;// time between the start and end of one attempt (54 trials)
let hits 			 = 0;      // number of successful selections
let misses 			 = 0;      // number of missed selections (used to calculate accuracy)
let database;                  // Firebase DB  

// Study control parameters
let draw_targets     = false;  // used to control what to show in draw()
let trials 			 = [];     // contains the order of targets that activate in the test
let current_trial    = 0;      // the current trial number (indexes into trials array above)
let attempt          = 0;      // users complete each test twice to account for practice (attemps 0 and 1)
let fitts_IDs        = [];     // add the Fitts ID for each selection here (-1 when there is a miss)

let aimbot = false;
let aimbotX;
let aimbotY;
let aimbotW;
let bg;
let sound;

// Target class (position and width)
class Target
{
  constructor(x, y, w)
  {
    this.x = x;
    this.y = y;
    this.w = w;
  }
}

// Runs once at the start
function setup()
{
    
  bg = loadImage('https://media.discordapp.net/attachments/897573939977535529/961299972148563978/unknown.png');
  sound = loadSound('y2mate (mp3cut.net) (2).mp3');
  
  createCanvas(700, 500);    // window size in px before we go into fullScreen()
  frameRate(60);             // frame rate (DO NOT CHANGE!)
  
  randomizeTrials();         // randomize the trial order at the start of execution
  
  textFont("Arial", 18);     // font size for the majority of the text
  drawUserIDScreen();        // draws the user start-up screen (student ID and display size)
}

// Runs every frame and redraws the screen
function draw()
{
  if (draw_targets)
  {     
    // The user is interacting with the 6x3 target grid
    
    background(bg);
    
    // Print trial count at the top left-corner of the canvas
    fill(color(255,255,255));
    textAlign(LEFT);
    strokeWeight(1);
    text("Trial " + (current_trial + 1) + " of " + trials.length, 50, 20);
    
    // Draw all 18 targets
	for (var i = 0; i < 18; i++) {
      drawTarget(i);
      drawSquare(i);
    }
    
    // Draw the user input area
    drawInputArea()

    // Draw the virtual cursor
    let x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width)
    let y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height)
    
    fill(color(255,20,147));
    circle(x, y, 0.5 * PPCM);
  }
}

// Print and save results at the end of 54 trials
function printAndSavePerformance()
{
  // DO NOT CHANGE THESE! 
  let accuracy			= parseFloat(hits * 100) / parseFloat(hits + misses);
  let test_time         = (testEndTime - testStartTime) / 1000;
  let time_per_target   = nf((test_time) / parseFloat(hits + misses), 0, 3);
  let penalty           = constrain((((parseFloat(95) - (parseFloat(hits * 100) / parseFloat(hits + misses))) * 0.2)), 0, 100);
  let target_w_penalty	= nf(((test_time) / parseFloat(hits + misses) + penalty), 0, 3);
  let timestamp         = day() + "/" + month() + "/" + year() + "  " + hour() + ":" + minute() + ":" + second();
  
  strokeWeight(1);
  background(color('black'));
  fill(color(255,255,255));   // set text fill color to white
  text(timestamp, 10, 20);    // display time on screen (top-left corner)
  
  textAlign(CENTER);
  text("Attempt " + (attempt + 1) + " out of 2 completed!", width/2, 60); 
  text("Hits: " + hits, width/2, 100);
  text("Misses: " + misses, width/2, 120);
  text("Accuracy: " + accuracy + "%", width/2, 140);
  text("Total time taken: " + test_time + "s", width/2, 160);
  text("Average time per target: " + time_per_target + "s", width/2, 180);
  text("Average time for each target (+ penalty): " + target_w_penalty + "s", width/2, 220);
  
  // Print Fitts IDS (one per target, -1 if failed selection, optional)
  // 

  // Saves results (DO NOT CHANGE!)
  let attempt_data = 
  {
        project_from:       GROUP_NUMBER,
        assessed_by:        student_ID,
        test_completed_by:  timestamp,
        attempt:            attempt,
        hits:               hits,
        misses:             misses,
        accuracy:           accuracy,
        attempt_duration:   test_time,
        time_per_target:    time_per_target,
        target_w_penalty:   target_w_penalty,
        fitts_IDs:          fitts_IDs
  }
  
  // Send data to DB (DO NOT CHANGE!)
  if (BAKE_OFF_DAY)
  {
    // Access the Firebase DB
    if (attempt === 0)
    {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
    }
    
    // Add user performance results
    let db_ref = database.ref('G' + GROUP_NUMBER);
    db_ref.push(attempt_data);
  }
}

// Mouse button was pressed - lets test to see if hit was in the correct target
function mousePressed() 
{
  // Only look for mouse releases during the actual test
  // (i.e., during target selections)
  if (draw_targets)
  {
    // Get the location and size of the target the user should be trying to select
    let target = getTargetBounds(trials[current_trial]);   
    
    // Check to see if the virtual cursor is inside the target bounds,
    // increasing either the 'hits' or 'misses' counters
        
    if (insideInputArea(mouseX, mouseY))
    {
      let virtual_x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width)
      let virtual_y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height)

      if (dist(target.x, target.y, aimbotX, aimbotY) < target.w/2) {
        if (sound.isPlaying()) sound.stop();
        sound.play();
        hits++;
      }
      else misses++;
      current_trial++; // Move on to the next trial/target
    }

    // Check if the user has completed all 54 trials
    if (current_trial === trials.length)
    {
      testEndTime = millis();
      draw_targets = false;          // Stop showing targets and the user performance results
      printAndSavePerformance();     // Print the user's results on-screen and send these to the DB
      attempt++;                      
      
      // If there's an attempt to go create a button to start this
      if (attempt < 2)
      {
        continue_button = createButton('START 2ND ATTEMPT');
        continue_button.mouseReleased(continueTest);
        continue_button.position(width/2 - continue_button.size().width/2, height/2 - continue_button.size().height/2);
      }
    } 
  }
}

// Draw target on-screen
function drawTarget(i)
{
  // Get the location and size for target (i)
  let target = getTargetBounds(i);
  let next_target = getTargetBounds(trials[current_trial+1]);
  let virtual_x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width);
  let virtual_y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height);
  
  if (abs(target.x - virtual_x) < target.w && abs(target.y - virtual_y) < target.w) {
    aimbotX = target.x;
    aimbotY = target.y;
    aimbotW = target.w * 0.25;
    aimbot = true;
  }
  else aimbot = false;
  
  // Check whether this target is the target the user should be trying to select
  if (trials[current_trial] === i)
  { 
    // Highlights the target the user should be trying to select
    // with a purple border
    stroke(color(191,64,191));
    strokeWeight(5);
    // If the virtual mouse is within the target's boundaries, the target is green and cyan otherwise
    if (dist(target.x, target.y, aimbotX, aimbotY) < target.w/2 && aimbot) fill(color(0, 255, 0));
    else fill(color(0,255,255));
    circle(target.x, target.y, target.w);
    // If the next target is also the current target, write '2x' on it
    if (trials[current_trial] === trials[current_trial+1]) {
      fill(color(191,64,191));
      strokeWeight(1);
      textSize(20);
      text('2x', target.x - 12, target.y + 5);
    }
  }
  // Next target
  else if (trials[current_trial+1] === i) {
    // Purple border
    stroke(color(191,64,191));
    strokeWeight(5);
    // Yellow color
    fill(color(255,255,0));
    circle(next_target.x, next_target.y, next_target.w);
  }
  // Does not draw a border if this is not the target the user
  // should be trying to select
  else {
    noStroke();
    fill(color(255, 255, 0));
    circle(target.x, target.y, target.w);
  }
  
  // Draw aimbot cursor
  if (aimbot) {
    fill(color('black'));
    noStroke();
    circle(aimbotX, aimbotY, aimbotW);
  }
  
  noFill();
  strokeWeight(3);
  stroke(color('gray'));
  // Draws a grey grid around the targets
  rect(target.x-target.w, target.y-target.w, target.w*2, target.w*2)
  
  if (i === 17) {
    target = getTargetBounds(trials[current_trial]);
    next_target = getTargetBounds(trials[current_trial+1]);
    // Draw a line from the current target to the next target
    stroke(color(191,64,191));
    strokeWeight(5);
    line(target.x, target.y, next_target.x, next_target.y);
  }
}

function drawSquare(i) {
  
  let target = getTargetBounds(i);
  // Top left edge of the square surrounding the current target
  let v1 = createVector(target.x - target.w, target.y - target.w);
  let mini_squareX = map(v1.x, 0, width, inputArea.x, inputArea.x + inputArea.w, true);
  let mini_squareY = map(v1.y, 0, height, inputArea.y, inputArea.y + inputArea.h, true);
  // Top left edge of the current target's square in the input area
  let mini_v1 = createVector(mini_squareX, mini_squareY);

  // Top left edge of the square surrounding the next target
  let next_target = getTargetBounds(trials[current_trial+1]);
  let next_v1 = createVector(next_target.x - next_target.w, next_target.y - next_target.w);
  let next_mini_squareX = map(next_v1.x, 0, width, inputArea.x, inputArea.x + inputArea.w);
  let next_mini_squareY = map(next_v1.y, 0, height, inputArea.y, inputArea.y + inputArea.h, true);
  // Top left edge of the next target's square in the input area
  let next_mini_v1 = createVector(next_mini_squareX, next_mini_squareY);
  
  if (trials[current_trial] === i) {
    
    if (abs(mini_v1.x - mouseX) < target.w/1.67 && abs(mini_v1.y - mouseY) < target.w/1.67) fill(color(0, 255, 0));
    else fill(color('cyan'));
    stroke(color('cyan'));
    strokeWeight(3);
    rect(mini_v1.x, mini_v1.y, target.w/1.67, target.w/1.67);
    if (trials[current_trial] === trials[current_trial+1]) {
      fill(color('191,64,191'));
      strokeWeight(1);
      textSize(20);
      text('2x', mini_v1.x + 9, mini_v1.y + 27);
    }
  }
  else if (trials[current_trial+1] === i) {
    // Yellow color
    stroke(color('gray'));
    strokeWeight(3);
    fill(color('purple'));
    rect(next_mini_v1.x, next_mini_v1.y, target.w/1.67, target.w/1.67);
  }
  else {
    stroke('gray');
    strokeWeight(3);
    fill(color('yellow'));
    rect(mini_v1.x, mini_v1.y, target.w/1.67, target.w/1.67);
  }
}

// Returns the location and size of a given target
function getTargetBounds(i)
{
  var x = parseInt(LEFT_PADDING) + parseInt((i % 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);
  var y = parseInt(TOP_PADDING) + parseInt(Math.floor(i / 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);

  return new Target(x, y, TARGET_SIZE);
}

// Evoked after the user starts its second (and last) attempt
function continueTest()
{
  // Re-randomize the trial order
  shuffle(trials, true);
  current_trial = 0;
  print("trial order: " + trials);
  
  // Resets performance variables
  hits = 0;
  misses = 0;
  fitts_IDs = [];
  
  continue_button.remove();
  
  // Shows the targets again
  draw_targets = true;
  testStartTime = millis();  
}

// Is invoked when the canvas is resized (e.g., when we go fullscreen)
function windowResized() 
{
  resizeCanvas(windowWidth, windowHeight);
    
  let display    = new Display({ diagonal: display_size }, window.screen);

  // DO NOT CHANGE THESE!
  PPI            = display.ppi;                        // calculates pixels per inch
  PPCM           = PPI / 2.54;                         // calculates pixels per cm
  TARGET_SIZE    = 1.5 * PPCM;                         // sets the target size in cm, i.e, 1.5cm
  TARGET_PADDING = 1.5 * PPCM;                         // sets the padding around the targets in cm
  MARGIN         = 1.5 * PPCM;                         // sets the margin around the targets in cm

  // Sets the margin of the grid of targets to the left of the canvas (DO NOT CHANGE!)
  LEFT_PADDING   = width/3 - TARGET_SIZE - 1.5 * TARGET_PADDING - 1.5 * MARGIN;        

  // Sets the margin of the grid of targets to the top of the canvas (DO NOT CHANGE!)
  TOP_PADDING    = height/2 - TARGET_SIZE - 3.5 * TARGET_PADDING - 1.5 * MARGIN;
  
  // Defines the user input area (DO NOT CHANGE!)
  inputArea      = {x: width/2 + 2 * TARGET_SIZE,
                    y: height/2,
                    w: width/3,
                    h: height/3
                   }

  // Starts drawing targets immediately after we go fullscreen
  draw_targets = true;
}

// Responsible for drawing the input area
function drawInputArea()
{
  noFill();
  stroke(color(220,220,220));
  strokeWeight(2);
  
  rect(inputArea.x, inputArea.y, inputArea.w, inputArea.h);
}