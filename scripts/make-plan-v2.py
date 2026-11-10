# Generates data/plan-v2.json from the V2 hand sketch (reference/sketch-v2b.jpeg, Nov 10 2026).
# Coordinates come from a perspective-corrected read of the sketch (26' x 40' outline, 1 square = 1 ft)
# snapped to the dimensions written on it. Re-run: python3 scripts/make-plan-v2.py
import json, os
root = os.path.join(os.path.dirname(__file__), '..')
base = json.load(open(os.path.join(root, 'data/default-plan.json')))
E, I = 0.5, 0.33
def W(i, a, b, c, d, ext=False, h=None, note=''):
    return dict(id=i, x1=a, y1=b, x2=c, y2=d, t=E if ext else I, ext=ext, h=h, note=note)
walls = [
    W('w1', 0, 0, 26, 0, True), W('w2', 26, 0, 26, 40, True), W('w3', 26, 40, 0, 40, True), W('w4', 0, 40, 0, 0, True),
    W('w5', 26, 0, 35, 0, True, note='Attached closet + laundry (east end is off the sketch)'),
    W('w6', 35, 0, 35, 10, True), W('w7', 35, 10, 26, 10, True),
    W('w8', 0, 4.9, 5, 4.9, note='Back of the bedroom closet; bath cabinet on the toilet side'),
    W('w9', 5, 4.9, 5, 7),
    W('w10', 5, 0, 5, 2.25, note='Privacy wall between the toilet and the shower'),
    W('w11', 5, 7, 12.5, 7, note='Bath / bedroom'),
    W('w12', 12.5, 0, 12.5, 18.5),
    W('w13', 0, 18.5, 9.5, 18.5),
    W('w14', 9.5, 15, 9.5, 18.5), W('w15', 9.5, 15, 12.5, 15, note="Bedroom vestibule, 3' wide"),
    W('w16', 12.5, 18.5, 26, 18.5),
    W('w17', 13.75, 34.5, 19.17, 34.5, h=3.5, note="Pony wall 5'-5\" between kitchen and entry"),
    W('w18', 19.17, 34.5, 26, 34.5), W('w19', 21, 34.5, 21, 40, note="Pantry 5' x 5'"),
]
def D(i, name, a, b, c, d, s, note='', typ='swing'):
    return dict(id=i, name=name, type=typ, x1=a, y1=b, x2=c, y2=d, swing=s, h=None, note=note)
doors = [
    D('d1', 'Bath door', 12.5, 2.5, 12.5, 5.0, -1, "2'-6\" door from the large bedroom (bath is now en suite). Swings into the bedroom so it clears the shower and vanity"),
    D('d3', 'Bedroom door', 9.5, 18.25, 9.5, 15.25, -1, "Sketch marks 3'-6\" here (the vestibule depth)"),
    D('d4', 'Large bedroom door', 12.5, 18.25, 12.5, 15.25, 1, "Sketch marks 3'-6\" here (the vestibule depth)"),
    D('d5', 'Closet + laundry door', 26, 4.75, 26, 2.25, 1),
    D('d6', 'Front door', 13.25, 40, 16.25, 40, -1),
    D('d8', 'Pantry door', 21.75, 34.5, 24.25, 34.5, 1, 'Not drawn on the V2 sketch; kept from the last plan'),
    D('d9', 'Side exterior door', 26, 34.25, 26, 31.25, -1, "36\" door, 3'-8\" past the end of the kitchen counter"),
]
def N(i, name, a, b, c, d, sill, head, note=''):
    return dict(id=i, name=name, x1=a, y1=b, x2=c, y2=d, sill=sill, head=head, note=note)
windows = [
    N('win1', 'Large bedroom window', 17.5, 0, 21.5, 0, 2.5, 6.67),
    N('win2', 'Bedroom window', 0, 10.75, 0, 14.75, 3.67, 6.67, "4' x 3'"),
    N('win3', 'Living window', 0, 20.75, 0, 28.75, 2.5, 6.67, "Sketch says 8' to 10' wide; drawn at 8'"),
    N('win4', 'Dining window', 0, 29.25, 0, 35.25, 2.67, 6.67, "6' x 4'"),
    N('win5', 'Bath window', 1.5, 0, 3.5, 0, 4.5, 6.67, 'Sketch says "window" over the toilet; size is a guess'),
]
def R(i, name, x, y, w, d, mat, col, note=''):
    return dict(id=i, name=name, x=x, y=y, w=w, d=d, ceil=None, floor=col, note=note, floorMat=mat)
WOOD, TILE = '#9b7653', '#e8e4dc'
rooms = [
    R('r1', 'Bath', 5, 0, 7.5, 7, 'hex', TILE, 'Shower + 7\' double vanity'),
    R('r2', 'Toilet room', 0, 0, 5, 4.9, 'hex', TILE),
    R('r3', 'Closet', 0, 4.9, 5, 2.1, 'wood', WOOD),
    R('r4', 'Bedroom', 0, 7, 9.5, 11.5, 'wood', WOOD),
    R('r5', 'Alcove', 9.5, 7, 3, 8, 'wood', WOOD),
    R('r6', 'Vestibule', 9.5, 15, 3, 3.5, 'wood', WOOD),
    R('r7', 'Large Bedroom', 12.5, 0, 13.5, 18.5, 'wood', WOOD, "Sketch notes 19'"),
    R('r8', 'Closet + Laundry', 26, 0, 9, 10, 'lvp', '#b9b2a6'),
    R('r9', 'Kitchen', 12.5, 18.5, 13.5, 16, 'wood', WOOD),
    R('r10', 'Living / Dining', 0, 18.5, 12.5, 21.5, 'wood', WOOD),
    R('r11', 'Entry', 12.5, 34.5, 8.5, 5.5, 'tile24', '#8d8a84'),
    R('r12', 'Pantry', 21, 34.5, 5, 5.5, 'lvp', '#b9b2a6', "5' x 5'"),
]
old = {i['id']: i for i in base['items']}
def keep(i, **kw):
    o = dict(old[i]); o.update(kw); return o
def It(i, label, kind, cx, cy, w, d, h, rot, color, note='', **kw):
    o = dict(id=i, label=label, kind=kind, cx=cx, cy=cy, w=w, d=d, h=h, rot=rot, color=color, note=note); o.update(kw); return o
items = [
    keep('i1'),
    It('i2', 'Linen cabinet 30"', 'cabinet', 1.5, 4.4, 2.5, 0.67, 7, 0, '#e6e1d8'),
    It('i3', 'Double vanity 7\'', 'vanity', 8.75, 5.96, 7, 1.75, 2.8, 0, '#5a4636', top='marble'),
    It('i4', 'Bedroom closet', 'cabinet', 2.5, 5.95, 4.6, 1.9, 7, 0, '#e6e1d8'),
    It('i28', 'Shower', 'shower', 8.15, 1.5, 4.5, 2.67, 7, 0, '#e8e8ea', 'Walk-in shower'),
    keep('i5', cx=3.65, cy=11.95),
    keep('i6'),
    keep('i7'), keep('i8'),
    It('i9', 'Counter', 'counter', 24.71, 24.375, 2.08, 7.25, 3, 0, '#e6e1d8', top='quartz'),
    keep('i10', cy=29.5),
    It('i11', 'Island', 'island', 16.2, 27.42, 6.67, 6.17, 3, 0, '#3a4a5a',
       "6'-8\" x 6'-2\": 3'-7\" aisle to the back counter, 3'-11\" to the pony wall", top='quartz'),
    keep('i12', cx=16.2, cy=27.42, note='Not drawn on the V2 sketch; kept from the last plan'),
    keep('i13'), keep('i14'), keep('i15'), keep('i16'), keep('i17'),
    It('i18', 'Mudroom cabinet', 'cabinet', 19.92, 37.2, 5, 1.83, 7, 90, '#c8b89c', '22" deep x 5\' long'),
    It('i19', 'Pantry shelves', 'shelf', 23.5, 39.1, 4.6, 1.3, 7, 0, '#c8b89c'),
    It('i20', 'Washer / dryer (stacked)', 'washer', 27.17, 1.25, 1.83, 2.0, 6.33, 0, '#eceef0'),
    keep('i22', cy=9.1),
] + [keep(k) for k in ['i23', 'i24', 'i25', 'i26', 'i27']]
plan = dict(specs=dict(base['specs'], name='Residence V2'), walls=walls, doors=doors, windows=windows,
            rooms=rooms, items=items, fixtures=[], checkIgnore=[])
json.dump(plan, open(os.path.join(root, 'data/plan-v2.json'), 'w'), indent=2)
print('data/plan-v2.json:', {k: len(v) for k, v in plan.items() if isinstance(v, list)})
