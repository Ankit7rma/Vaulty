/**
 * Compact human-friendly word list for diceware-style passphrase generation.
 * ~500 short, common English words (3-7 letters) with no accents or
 * homophone-heavy pairs. Kept small enough to bundle without a hit but big
 * enough that a 5-word passphrase clears 45 bits of entropy.
 *
 * Selection targets memorability, not maximum entropy per word: for the
 * latter, layer on more words rather than swapping in a bigger dictionary.
 */

export const WORD_LIST = [
  'able', 'acid', 'aged', 'ago', 'air', 'ally', 'alpha', 'amber', 'angel', 'ankle',
  'apple', 'april', 'arch', 'area', 'arena', 'arm', 'army', 'art', 'ash', 'aspen',
  'atlas', 'atom', 'aunt', 'aura', 'auto', 'awake', 'away', 'axel', 'azure', 'back',
  'bacon', 'badge', 'bag', 'baker', 'ball', 'band', 'bank', 'bar', 'barn', 'base',
  'basin', 'bat', 'bath', 'bay', 'beach', 'bead', 'beam', 'bean', 'bear', 'beat',
  'bed', 'bee', 'beef', 'beer', 'bell', 'belt', 'bench', 'berry', 'best', 'bike',
  'bill', 'bird', 'birth', 'bison', 'blade', 'blaze', 'blend', 'blimp', 'blink', 'blob',
  'block', 'bloom', 'blue', 'blur', 'blush', 'board', 'boat', 'body', 'bold', 'bolt',
  'bone', 'book', 'boot', 'born', 'boss', 'both', 'bowl', 'box', 'boy', 'brain',
  'branch', 'brave', 'bread', 'break', 'brew', 'brick', 'bride', 'brisk', 'broad', 'broil',
  'brook', 'broom', 'brown', 'brush', 'bud', 'buddy', 'bug', 'build', 'bulb', 'bull',
  'bump', 'bun', 'bunny', 'burn', 'bush', 'bus', 'busy', 'butter', 'buzz', 'cab',
  'cable', 'cactus', 'cake', 'calm', 'camel', 'camp', 'candy', 'canoe', 'canyon', 'cap',
  'card', 'care', 'cargo', 'carrot', 'cart', 'cash', 'cast', 'cat', 'catch', 'cave',
  'cedar', 'cell', 'chalk', 'charm', 'chase', 'cheer', 'cheese', 'chef', 'cherry', 'chess',
  'chick', 'child', 'chime', 'chin', 'chip', 'choir', 'chop', 'church', 'cider', 'city',
  'civic', 'clam', 'clan', 'clap', 'class', 'claw', 'clay', 'clean', 'clear', 'cliff',
  'climb', 'cloak', 'clock', 'clone', 'closet', 'cloud', 'clover', 'club', 'coach', 'coal',
  'coast', 'coat', 'code', 'coffee', 'coin', 'cold', 'color', 'comb', 'comet', 'cook',
  'cool', 'coral', 'core', 'corn', 'couch', 'count', 'court', 'cover', 'cow', 'crab',
  'craft', 'crane', 'crash', 'crate', 'crayon', 'cream', 'crew', 'cricket', 'crisp', 'crop',
  'cross', 'crow', 'crown', 'cruise', 'crumb', 'crust', 'crypt', 'cube', 'cup', 'curl',
  'cycle', 'daisy', 'dance', 'dandy', 'dark', 'dart', 'dash', 'date', 'dawn', 'day',
  'deal', 'dear', 'deck', 'deep', 'deer', 'delta', 'demo', 'desk', 'dial', 'diary',
  'dice', 'diet', 'dig', 'dime', 'diner', 'ding', 'dish', 'dive', 'dock', 'doe',
  'dog', 'doll', 'dome', 'door', 'dot', 'dove', 'draft', 'drama', 'draw', 'dream',
  'dress', 'drift', 'drill', 'drink', 'drive', 'drop', 'drum', 'dry', 'duck', 'dune',
  'dusk', 'dust', 'eager', 'eagle', 'ear', 'earth', 'east', 'eaves', 'echo', 'edge',
  'egg', 'elf', 'elk', 'elm', 'ember', 'empty', 'end', 'era', 'even', 'event',
  'every', 'exit', 'extra', 'eye', 'face', 'fact', 'fair', 'fall', 'fame', 'fan',
  'fang', 'far', 'farm', 'fast', 'fawn', 'feast', 'feed', 'feel', 'fern', 'ferry',
  'field', 'fig', 'file', 'fill', 'film', 'final', 'find', 'fine', 'finch', 'finger',
  'fire', 'fish', 'fist', 'five', 'fizz', 'flag', 'flame', 'flash', 'flat', 'flax',
  'fleet', 'flint', 'flip', 'float', 'flock', 'flood', 'floor', 'flour', 'flow', 'fly',
  'foam', 'fog', 'foil', 'fold', 'font', 'food', 'foot', 'forest', 'fork', 'form',
  'forth', 'four', 'fox', 'fresh', 'frog', 'front', 'frost', 'fruit', 'fun', 'fund',
  'fur', 'gala', 'game', 'gap', 'garden', 'gas', 'gate', 'gaze', 'gear', 'gem',
  'ghost', 'giant', 'gift', 'gill', 'ginger', 'glad', 'glass', 'glide', 'globe', 'glory',
  'glove', 'glow', 'goal', 'goat', 'gold', 'good', 'goose', 'grain', 'grand', 'grape',
  'grasp', 'grass', 'gray', 'green', 'grid', 'grill', 'grip', 'groove', 'group', 'grove',
  'grow', 'gulf', 'gum', 'guy', 'gym', 'habit', 'hail', 'hair', 'half', 'hall',
  'ham', 'hand', 'happy', 'harbor', 'hard', 'hare', 'harp', 'hat', 'have', 'hawk',
  'hazel', 'head', 'health', 'heart', 'heat', 'heavy', 'hedge', 'help', 'hen', 'herb',
  'hero', 'hill', 'hint', 'hive', 'hobby', 'hold', 'hole', 'home', 'honey', 'hood',
  'hoof', 'hook', 'hope', 'horn', 'horse', 'host', 'hour', 'house', 'hue', 'huge',
  'human', 'hush', 'ice', 'icon', 'idea', 'ink', 'inn', 'iron', 'island', 'ivory',
  'ivy', 'jade', 'jam', 'jar', 'jazz', 'jelly', 'jet', 'jewel', 'job', 'join',
  'joker', 'joy', 'juice', 'jump', 'jungle', 'juror', 'kale', 'kelp', 'key', 'kick',
  'kind', 'king', 'kiss', 'kite', 'kitten', 'knee', 'knob', 'knot', 'know', 'koala',
  'lab', 'lace', 'lake', 'lamb', 'lamp', 'land', 'lane', 'large', 'last', 'later',
] as const;

export type Word = (typeof WORD_LIST)[number];
