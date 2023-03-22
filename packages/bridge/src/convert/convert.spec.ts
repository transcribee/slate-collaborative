import * as Automerge from '@automerge/automerge'

import { toSlateOp } from './index'
import { createDoc, createNode, toSync } from '../utils'

describe('convert operations to slatejs model', () => {
  it('convert insert operations', () => {
    const doc1 = createDoc()
    const doc2 = Automerge.clone(doc1)

    const newDoc = Automerge.change(doc1, d => {
      d.children.push(toSync(createNode('paragraph', 'Hello World!')))
      d.children.splice(0, 0, toSync(createNode('paragraph', 'Hello World 2!')))
    })

    let slateOps: any[] = []

    const changes = Automerge.getChanges(doc2, newDoc)
    Automerge.applyChanges(doc2, changes, {
      patchCallback: (patches, before) => {
        slateOps.push(...toSlateOp(patches, before))
      }
    })

    console.log(JSON.stringify(slateOps, undefined, 2))

    const expectedOps = [
      {
        type: 'insert_node',
        path: [1],
        node: {
          type: 'paragraph',
          children: [
            {
              text: ''
            }
          ]
        }
      },
      {
        type: 'insert_text',
        text: 'Hello World!',
        path: [1, 0],
        offset: 0
      },
      {
        type: 'insert_node',
        path: [2],
        node: {
          type: 'paragraph',
          children: [
            {
              text: ''
            }
          ]
        }
      },
      {
        type: 'insert_text',
        text: 'Hello World 2!',
        path: [2, 0],
        offset: 0
      }
    ]

    expect(slateOps).toStrictEqual(expectedOps)
  })

  it('convert text operations', () => {
    const doc1 = createDoc([createNode('paragraph', 'Hello')])
    const doc2 = Automerge.clone(doc1)

    const change = Automerge.change(doc1, d => {
      d.children[0].children[0].text.insertAt(5, ' World!')
    })

    let slateOps: any[] = []

    const changes = Automerge.getChanges(doc2, change)
    Automerge.applyChanges(doc2, changes, {
      patchCallback: (patches, before) => {
        slateOps.push(...toSlateOp(patches, before))
      }
    })

    const expectedOps = [
      {
        type: 'insert_text',
        path: [0, 0],
        offset: 5,
        text: ' World!'
      }
    ]

    expect(slateOps).toStrictEqual(expectedOps)
  })

  it('convert remove operations', () => {
    const doc1 = Automerge.change(createDoc(), d => {
      d.children.push(createNode('paragraph', 'hello!'))
      d.children.push(createNode('paragraph', 'hello twice!'))
      d.children[1].children[0].text = 'hello!'
    })

    const doc2 = Automerge.clone(doc1)

    const change = Automerge.change(doc1, d => {
      delete d.children[1]
      delete d.children[0].children[0]
    })

    let slateOps: any[] = []

    const changes = Automerge.getChanges(doc2, change)
    Automerge.applyChanges(doc2, changes, {
      patchCallback: (patches, before) => {
        slateOps.push(...toSlateOp(patches, before))
      }
    })

    const expectedOps = [
      {
        type: 'remove_node',
        path: [1],
        node: { children: [] }
      },
      {
        type: 'remove_node',
        path: [0, 0],
        node: {
          children: []
        }
      }
    ]

    expect(slateOps).toStrictEqual(expectedOps)
  })
})
