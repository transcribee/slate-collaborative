import { toSlatePath, toJS } from '../utils/index'
import { getTarget } from '../path'

const removeTextOp = ({ index, path }) => () => ({
  type: 'remove_text',
  path: toSlatePath(path).slice(0, path.length),
  offset: index,
  text: '*',
  marks: []
})

const removeMarkOp = ({ path, index }) => (map, doc) => {
  const slatePath = toSlatePath(path)
  const target = getTarget(doc, slatePath)

  return {
    type: 'remove_mark',
    path: slatePath,
    mark: {
      type: target.marks[index].type
    }
  }
}

const removeNodesOp = ({ index, obj, path }) => (map, doc) => {
  const slatePath = toSlatePath(path)
  if (!map.hasOwnProperty(obj)) {
    const target = getTarget(doc, [...slatePath, index] as any)

    map[obj] = target
  }

  return {
    type: 'remove_node',
    path: slatePath.length ? slatePath.concat(index) : [index],
    node: {
      object: 'text'
    }
  }
}

const removeByType = {
  text: removeTextOp,
  nodes: removeNodesOp,
  marks: removeMarkOp
}

const opRemove = (op, [map, ops]) => {
  try {
    const { index, path, obj } = op

    if (map.hasOwnProperty(obj) && op.type !== 'text') {
      map[obj].splice(index, 1)

      return [map, ops]
    }

    if (!path) return [map, ops]

    const fn = removeByType[path[path.length - 1]]

    return [map, [...ops, fn(op)]]
  } catch (e) {
    console.error(e, op, toJS(map))

    return [map, ops]
  }
}

export default opRemove
