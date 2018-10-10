import {
    dataChannelIncomingSubject,
    dataChannelOutgoingSubject,
    dataChannelOpenedEvent,
    dataChannelClosedEvent,
    dataChannelClosingSubject
} from './communication';
import {
    randomToken
} from './utils';
import {
    MESSAGE_TYPE
} from './message-type';
import {
    writeData
} from './data-logger'


var food = {};
var foodDiameter = 16;

var sColor = {
    r: 0,
    g: 150,
    b: 150
};

var sColor2 = {
    r: 0,
    g: 191,
    b: 255
};

let snakes = window.snakes = {};

var snakeSize = 24;
var gamePaused = true;
var highScore = 50;

let leaderBoard = document.getElementById('leaderBoard');

function setup() {
    console.log('setup');
    localStorage.clear();
    var iHeight = window.innerHeight <= 542 ? window.innerHeight - 20 : 522;
    var iWidth = window.innerWidth <= 957 ? window.innerWidth - 20 : 937;
    createCanvas(900, 600);
    window.mySnake = snakes['mySnake'] = {
        s: new Snake(width / 4, height / 2, 0, 0, 0, 0, sColor, 50, 'mySnake', 'mySnake'),
        g: new Ghost(),
        // tailLength: 50
    };
    document.getElementById('gameUrl').innerHTML = window.location;
    document.getElementById('homeUrl').href = window.location.href.split('#')[0];
    // pickLocation();
}

function draw() {
    background(245, 248, 250);
    noStroke();
    fill(54);
    // textSize(16);
    // text("tail length: " + tailLength, width / 8, 30);
    // text("high score: " + localStorage.getItem("_highScore"), width / 8, 60);
    Object.keys(snakes).forEach((snakeId) => {
        let s = snakes[snakeId].s;
        let ghost = snakes[snakeId].g;
        if (!gamePaused) {
            ghost.update();
            ghost.show();

            var ghostVect = createVector(ghost.x, ghost.y);
            Object.keys(food).forEach((key) => {
                if (s.eat(food[key])) {
                    if (s.tailLength > localStorage.getItem("_highScore")) {
                        localStorage._highScore = s.tailLength;
                        localStorage._highClient = s.name;
                    }
                    if (s.clientId === 'mySnake') {
                        broadcastMessage({
                            type: MESSAGE_TYPE.EAT_EVENT,
                            snake: {
                                x: s.position.x,
                                y: s.position.y,
                                tailLength: s.tailLength
                            },
                            ghost: {
                                x: ghost.x,
                                y: ghost.y,
                                xspeed: ghost.xspeed,
                                yspeed: ghost.yspeed,
                            },
                            foodId: key
                        })
                    }
                    delete food[key];
                    if (Object.keys(food).length === 0) {
                        pickLocation();
                    }
                    updateLeaderBoard();
                }
            });
            // if (food.length > 0 && s.eat(food[0])) {
            //     if (s.tailLength > localStorage.getItem("_highScore")) {
            //         localStorage._highScore = s.tailLength;
            //     }
            //     food.shift();
            //     if (food.length === 0) {
            //         pickLocation();
            //     }
            // }

            // snake follows the ghost to steer
            s.seek(ghostVect);
            s.update();
            s.death();
        }
        s.display();
    })
    Object.keys(food).forEach((key) => {
        fill(255, 0, 100);
        ellipse(food[key].x, food[key].y, foodDiameter, foodDiameter);
    });
}

function pickLocation() {
    var offset = 40;
    let newFoodLoc = {
        x: random(offset, width - offset),
        y: random(offset, height - offset),
        key: randomToken()
    };
    broadcastMessage({
        type: MESSAGE_TYPE.NEW_FOOD,
        newFoodLoc
    });
    hanldeNewFood(newFoodLoc);
}

function hanldeNewFood(newFoodLoc) {
    food[newFoodLoc.key] = createVector(newFoodLoc.x, newFoodLoc.y);
}

function keyPressed() {
    broadcastMessage({
        type: MESSAGE_TYPE.KEY_EVENT,
        keyCode
    });
    if (snakes['mySnake'] && !gamePaused) {
        hanldeKeyPressed(keyCode, snakes['mySnake'].g);
        writeData({
            gameState: getGameState(),
            keyCode
        });
    }
}

const getGameState = () => {
    let otherSnakesState = [];
    let foodState = [];
    let mySnakeState = snakes['mySnake'].s.history.map(vec => {
        return {
            x: Math.round(vec.x),
            y: Math.round(vec.y)
        }
    });

    for (let player in snakes) {
        if (player !== 'mySnake') {
            otherSnakesState.push(
                snakes[player].s.history.map(vec => {
                    return {
                        x: Math.round(vec.x),
                        y: Math.round(vec.y)
                    }
                })
            )
        }
    }
    for (let foodItem in food) {
        foodState.push({
            x: Math.round(food[foodItem].x),
            y: Math.round(food[foodItem].y)
        })
    }

    return {
        mySnakeState,
        otherSnakesState,
        foodState
    }
}

function hanldeKeyPressed(keyCode, ghost) {
    var ghostX = ghost.xspeed;
    var ghostY = ghost.yspeed;
    if (keyCode === UP_ARROW) {
        if (ghostY < 1) {
            ghost.dir(0, -1);
        }
    } else if (keyCode === DOWN_ARROW) {
        if (ghostY > -1) {
            ghost.dir(0, 1);
        }
    } else if (keyCode === RIGHT_ARROW) {
        if (ghostX > -1) {
            ghost.dir(1, 0);
        }
    } else if (keyCode === LEFT_ARROW) {
        if (ghostX < 1) {
            ghost.dir(-1, 0);
        }
    }
}

function Snake(posX, posY, velX, velY, accX, accY, color, tailLength, clientId, name) {
    // this.acceleration = createVector(0, 0);
    // this.velocity = createVector(0, 0);
    // this.position = createVector(x, y);
    this.acceleration = createVector(accX, accY);
    this.velocity = createVector(velX, velY);
    this.position = createVector(posX, posY);
    this.r = snakeSize;
    this.maxspeed = 3;
    this.maxforce = 0.2;
    this.history = [];
    this.eatingVal = 0;
    this.tailLength = tailLength;
    this.clientId = clientId;
    this.name = name;

    // Method to update location
    this.update = function () {
        var v = createVector(this.position.x, this.position.y);
        this.history.push(v);

        if (this.history.length > this.tailLength) {
            this.history.splice(0, 1);
        }
        // Update velocity
        this.velocity.add(this.acceleration);
        // Limit speed
        this.velocity.limit(this.maxspeed);
        this.position.add(this.velocity);
        // Reset accelerationelertion to 0 each cycle
        this.acceleration.mult(0);

        if (this.eatingVal > 0) {
            this.eatingVal -= 0.5;
        }
    };

    this.applyForce = function (force) {
        // We could add mass here if we want A = F / M
        this.acceleration.add(force);
    };

    // A method that calculates a steering force towards a target
    // STEER = DESIRED MINUS VELOCITY
    this.seek = function (target) {

        var desired = p5.Vector.sub(target, this.position); // A vector pointing from the location to the target

        // Scale to maximum speed
        desired.setMag(this.maxspeed);

        // Steering = Desired minus velocity
        var steer = p5.Vector.sub(desired, this.velocity);
        steer.limit(this.maxforce); // Limit to maximum steering force

        this.applyForce(steer);
    };

    this.reset = function () {
        // gamePaused = true;
        // var that = this;
        this.history.forEach(function (seg) {
            seg.add(random(-10, 10), random(-10, 10));
        });
        setTimeout(() => {
            this.tailLength = 50;
            this.history = [];
            this.position = createVector(width / 2, height / 2);
            updateLeaderBoard();
            // gamePaused = false;
        }, 500);
    }

    this.death = function () {
        var offset = this.r / 2;
        var outOfBoundsX = this.position.x < offset || this.position.x > width - offset;
        var outOfBoundsY = this.position.y < offset || this.position.y > height - offset;
        if (outOfBoundsX || outOfBoundsY) {
            this.reset();
        } else {
            Object.keys(snakes).forEach((snakeId) => {
                if (snakeId !== this.clientId) {
                    let s = snakes[snakeId].s;
                    for (var i = 0; i < s.history.length - 10; i++) {
                        var pos = s.history[i];
                        var d = dist(this.position.x, this.position.y, pos.x, pos.y);
                        if (d < 2) {
                            this.reset();
                        }
                    }
                }
            });
        }
    }

    this.eat = function (pos) {
        var d = dist(this.position.x, this.position.y, pos.x, pos.y);
        if (d < foodDiameter) {
            this.tailLength += 20;
            this.eatingVal = 20;
            return true;
        } else {
            return false;
        }
    }

    this.display = function () {
        // Draw a snake rotated in the direction of velocity
        var theta = this.velocity.heading() + PI / 2;
        fill(color.r, color.g, color.b);
        noStroke();
        // text("high score: " + localStorage.getItem("_highScore"), width / 8, 60);
        for (var i = 0; i < this.history.length; i++) {
            var pos = this.history[i];
            var size = map(i, 0, this.history.length, 5, this.r);
            ellipse(pos.x, pos.y, size, size);
        }
        fill(0, 150, 150);
        ellipse(this.x, this.y, this.r, this.r);
        push();
        translate(this.position.x, this.position.y);
        rotate(theta);
        fill(0, 210, 150);
        ellipse(0, -this.eatingVal, this.r, this.r);
        fill(255, 0, 0);
        rect(-2, -2 * this.eatingVal, 4, 15);
        stroke(0);
        fill(255);
        triangle(-10, -20, -10, 0, 0, 0);
        triangle(10, -20, 10, 0, 0, 0);
        fill(0, 150, 150);
        noStroke();
        ellipse(0, 0, this.r, this.r);
        if (!gamePaused) {
            fill(255);
            ellipse(-this.r / 5, 0, 12, 12);
            ellipse(this.r / 5, 0, 12, 12);
            fill(98);
            ellipse(-this.r / 5, 0, 6, 6);
            ellipse(this.r / 5, 0, 6, 6);
        } else {
            fill(255);
            textSize(12);
            text("X", -this.r / 4 - 1, 0);
            text("X", 1, 0);
        }
        pop();
        fill(116, 54, 147);
        textSize(12);
        if (this.history.length > 0) {
            text(this.name, this.history[0].x, this.history[0].y);
        }
    };
}

function Ghost(x = 0, y = width / 2, xspeed = 3, yspeed = 0) {
    this.x = x;
    this.y = y;
    this.xspeed = xspeed;
    this.yspeed = yspeed;

    this.dir = function (x, y) {
        this.xspeed = x * 5;
        this.yspeed = y * 5;
    }

    this.update = function () {

        this.x = this.x + this.xspeed;
        this.y = this.y + this.yspeed;

        this.x = constrain(this.x, 0, width - 20);
        this.y = constrain(this.y, 0, height - 20);
    }

    this.show = function () {
        fill(255, 0);
        noStroke();
        rect(this.x, this.y, 20, 20);
    }
}
const broadcastMessage = (message) => {
    dataChannelOutgoingSubject.next({
        message
    });
}
dataChannelOpenedEvent.subscribe((event) => {
    console.log('Opened', event.clientId);
    if (snakes['mySnake']) {
        document.getElementById('text-box-container').style.display = 'block';
        updateLeaderBoard();
        broadcastMessage({
            type: MESSAGE_TYPE.NEW_SNAKE,
            snake: {
                posX: snakes['mySnake'].s.position.x,
                posY: snakes['mySnake'].s.position.y,
                velX: snakes['mySnake'].s.velocity.x,
                velY: snakes['mySnake'].s.velocity.y,
                accX: snakes['mySnake'].s.acceleration.x,
                accY: snakes['mySnake'].s.position.y,
                tailLength: snakes['mySnake'].s.tailLength
            },
            ghost: {
                x: snakes['mySnake'].g.x,
                y: snakes['mySnake'].g.y,
                xspeed: snakes['mySnake'].g.xspeed,
                yspeed: snakes['mySnake'].g.yspeed,
            },
            name: snakes['mySnake'].s.name
        })
    }
});
dataChannelClosedEvent.subscribe((event) => {
    delete snakes[event.clientId];
});
dataChannelIncomingSubject.subscribe((message) => {
    switch (message.message.type) {
        case MESSAGE_TYPE.NEW_SNAKE:
            if (snakes[message.clientId]) {
                // snakes[message.clientId].s.position = createVector(message.message.snake.posX, message.message.snake.posY);
                // snakes[message.clientId].s.acceleration = createVector(message.message.snake.accX, message.message.snake.accY);
                // snakes[message.clientId].s.velocity = createVector(message.message.snake.velX, message.message.snake.velY);
                // snakes[message.clientId].s.tailLength = message.message.snake.tailLength;

                // snakes[message.clientId].g.x = message.message.ghost.x;
                // snakes[message.clientId].g.y = message.message.ghost.y;
                // snakes[message.clientId].g.xspeed = message.message.ghost.xspeed;
                // snakes[message.clientId].g.yspeed = message.message.ghost.yspeed;
            } else {
                snakes[message.clientId] = {
                    s: new Snake(
                        message.message.snake.posX,
                        message.message.snake.posY,
                        message.message.snake.velX,
                        message.message.snake.velY,
                        message.message.snake.accX,
                        message.message.snake.accY,
                        sColor2, message.message.snake.tailLength,
                        message.clientId,
                        message.message.name !== 'mySnake' ? message.message.name : message.clientId),
                    g: new Ghost(message.message.ghost.x, message.message.ghost.y, message.message.ghost.xspeed, message.message.ghost.yspeed)
                }
                // Start game if paused
                gamePaused = false;
            }
            if (Object.keys(food).length === 0) {
                pickLocation();
            }
            break;
        case MESSAGE_TYPE.KEY_EVENT:
            if (snakes[message.clientId]) {
                hanldeKeyPressed(message.message.keyCode, snakes[message.clientId].g);
            }
            break;
        case MESSAGE_TYPE.NEW_FOOD:
            if (snakes[message.clientId]) {
                hanldeNewFood(message.message.newFoodLoc);
            }
            break;
        case MESSAGE_TYPE.EAT_EVENT:
            let snakeId = message.clientId;
            if (food[message.message.foodId]) {
                delete food[message.message.foodId];
            }
            if (snakes[snakeId] && snakes[snakeId].s.tailLength < message.message.snake.tailLength) {
                // snakes[message.clientId].s.position = createVector(message.message.snake.posX, message.message.snake.posY);
                // snakes[message.clientId].s.acceleration = createVector(message.message.snake.accX, message.message.snake.accY);
                // snakes[message.clientId].s.velocity = createVector(message.message.snake.velX, message.message.snake.velY);
                snakes[message.clientId].s.tailLength = message.message.snake.tailLength;

                // snakes[message.clientId].g.x = message.message.ghost.x;
                // snakes[message.clientId].g.y = message.message.ghost.y;
                // snakes[message.clientId].g.xspeed = message.message.ghost.xspeed;
                // snakes[message.clientId].g.yspeed = message.message.ghost.yspeed;
            }
            if (snakes[message.clientId].s.tailLength > localStorage.getItem("_highScore")) {
                localStorage._highScore = snakes[message.clientId].s.tailLength;
                localStorage._highClient = snakes[message.clientId].s.name;
            }
            updateLeaderBoard();
            break;
        case MESSAGE_TYPE.NAME_EVENT:
            if (snakes[message.clientId]) {
                snakes[message.clientId].s.name = message.message.name;
            }
            break;
    }
});
window.submitName = () => {
    let name = document.getElementById('name-text-box').value;
    if (name && snakes['mySnake']) {
        snakes['mySnake'].s.name = name;
        broadcastMessage({
            type: MESSAGE_TYPE.NAME_EVENT,
            name
        });
        document.getElementById('text-box-container').style.display = 'none';
        updateLeaderBoard();
    }
}
window.setup = setup;
window.draw = draw;
window.keyPressed = keyPressed;
const updateLeaderBoard = () => {
    leaderBoard.innerHTML = `<div class="high-score">HIGH SCORE <span class="client-id">${localStorage._highClient  || 'NA'}:</span> ${localStorage._highScore  || 'NA'}</div>`;
    Object.keys(snakes).forEach((snakeId) => {
        let s = snakes[snakeId].s;
        leaderBoard.innerHTML += `</br> <span class="client-id">${s.name}:</span>  ${s.tailLength}`;
    });
}