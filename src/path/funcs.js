function generatePathDataFromVertices(vertices, types) {
  let pathData = `M${vertices[0].x},${vertices[0].y}`;
  for (let i = 1; i < vertices.length; i++) {
    const vertex = vertices[i];
    if (!types.has(vertex)) continue; // TODO this is a serious flaw, the path is broken
    const next = vertices[i+1] ?? vertices[0];
    const command = types.get(vertex);
    if (vertex.x === next.x && vertex.y === next.y) {
      continue;
    }
    switch (command) {
      case 'L':
      pathData += ` L${vertex.x},${vertex.y}`;
      break;
      case 'Q':
      pathData += ` Q${vertex.x},${vertex.y},${next.x},${next.y}`;
      break;
    }
  }
  pathData += ' Z';
  return pathData;
}

function getVerticesFromPathData(pathData) {
  const vertices = [];
  const types = new WeakMap();
  const commands = pathData.match(/[a-zA-Z][^a-zA-Z]*/g); // Split by command characters

  let currentX = 0;
  let currentY = 0;

  for (let inx = 0; inx < commands.length; inx++) {
    const command = commands[inx];
    const type = command[0];
    const coords = command.slice(1).trim().split(/[\s,]+/).map(Number);

    switch (type) {
      case 'M': // Move to
      case 'L': // Line to
        for (let i = 0; i < coords.length; i += 2) {
          currentX = coords[i];
          currentY = coords[i + 1];
          let p = { x: currentX, y: currentY };
          p = getPointFrom(p, vertices);
          vertices.push(p);
          types.set(p, type);
        }
        break;
      case 'Q':
        const [kx, ky, zx, zy] = coords;
        let pk = { x: kx, y: ky };
        pk = getPointFrom(pk, vertices);
        let pz = { x: zx, y: zy };
        pz = getPointFrom(pz, vertices);
        vertices.push(pk, pz);
        types.set(pk, 'Q');
        //let typ = 'L';
        //if (commands[inx-1][0] === 'Q') {
        //  typ = 'Q';
        //}
        let typ = 'L';
        types.set(pz, typ);
      break;
    }
  };

  return [vertices, types];
}

function getPointFrom(p, vertices) {
  return vertices.find(v => {
    return v.x === p.x && v.y === p.y;
  }) ?? p;
}

function closestProjectedPoint(points, clickPoint) {
  let smallest = Infinity;
  let projected, index;
  const pp = [...points, points[0]]; // closed path
  for (let i = 1, p = {x: 0, y: 0}, curr = 0; i < pp.length; i++) {
    p = projectPointOntoSegment(pp[i-1], pp[i], clickPoint);
    curr = distance(clickPoint, p);
    if (curr < smallest) {
      smallest = curr;
      projected = p;
      index = i-1;
    }
  }
  return [projected, index + 1];
}

function distance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to project a point onto a segment (p1, p2)
function projectPointOntoSegment(p1, p2, clickPoint) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Calculate t, the parameter of the projection point along the line
  const t = ((clickPoint.x - p1.x) * dx + (clickPoint.y - p1.y) * dy) / (dx * dx + dy * dy);

  // Clamp t to [0, 1] to stay within the segment bounds
  const clampedT = Math.max(0, Math.min(1, t));

  // Calculate the projection point along the segment
  const projectedPoint = {
    x: p1.x + clampedT * dx,
    y: p1.y + clampedT * dy
  };
  projectedPoint.x = Math.round(projectedPoint.x);
  projectedPoint.y = Math.round(projectedPoint.y);
  //console.log({x, y}, projectedPoint)
  return projectedPoint;
}

export {closestProjectedPoint, generatePathDataFromVertices, getVerticesFromPathData, };
