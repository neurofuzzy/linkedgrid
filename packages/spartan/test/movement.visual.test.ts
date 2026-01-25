import { visual } from './visual-helpers';

visual('player moves right 3 times', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, 1, { hp: 100 });
    },
    act: ({ spatial }) => {
        spatial.move(5, 5, 6, 5, 1);
        spatial.move(6, 5, 7, 5, 1);
        spatial.move(7, 5, 8, 5, 1);
    }
});

visual('spawn multiple entities', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 10, 10, 1);
    },
    act: ({ spatial }) => {
        // Add entities one at a time to show spawning process
        spatial.spawn('enemy', 12, 10, 1);
        spatial.spawn('enemy', 10, 12, 1);
        spatial.spawn('item', 11, 11, 2);
    }
});

visual('entity moves in a square', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 5, 5, 1);
    },
    act: ({ spatial }) => {
        // Right
        spatial.move(5, 5, 6, 5, 1);
        spatial.move(6, 5, 7, 5, 1);
        // Down
        spatial.move(7, 5, 7, 6, 1);
        spatial.move(7, 6, 7, 7, 1);
        // Left
        spatial.move(7, 7, 6, 7, 1);
        spatial.move(6, 7, 5, 7, 1);
        // Up
        spatial.move(5, 7, 5, 6, 1);
        spatial.move(5, 6, 5, 5, 1);
    }
});

visual('projectile hits enemy', {
    arrange: ({ spatial }) => {
        spatial.spawn('player', 2, 5, 1);
        spatial.spawn('enemy', 8, 5, 1);
    },
    act: ({ spatial }) => {
        // Fire projectile
        spatial.spawn('projectile', 3, 5, 2);
        spatial.move(3, 5, 4, 5, 2);
        spatial.move(4, 5, 5, 5, 2);
        spatial.move(5, 5, 6, 5, 2);
        spatial.move(6, 5, 7, 5, 2);
        spatial.move(7, 5, 8, 5, 2);
        
        // Hit!
        spatial.remove(8, 5, 2); // Remove projectile
        spatial.remove(8, 5, 1); // Remove enemy
    }
});

visual('multiple layers at same cell', {
    arrange: ({ spatial }) => {
        spatial.spawn('item', 10, 10, 1);
        spatial.spawn('player', 10, 10, 2);
    },
    act: ({ spatial }) => {
        // Player moves away
        spatial.move(10, 10, 11, 10, 2);
        // Item still there at (10, 10)
    }
});
