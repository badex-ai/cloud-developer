

import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import { TodoItem } from '../models/TodoItem'
import { TodoUpdate } from '../models/TodoUpdate'

const XAWS = AWSXRay.captureAWS(AWS)
const logger = createLogger('TodosAccess')

// TODO: Implement the dataLayer logic

export class TodosAccess {
    constructor(
        private readonly docClient: DocumentClient = new XAWS.DynamoDB.DocumentClient(),
        private readonly todosTable = process.env.TODOS_TABLE,
        private readonly todosIndex = process.env.TODOS_CREATED_AT_INDEX
    ) { }

    async getAllTodos(userId: string): Promise<TodoItem[]> {
        logger.info(`Getting all todos for user ${userId}`)

        const result = await this.docClient.query({
            TableName: this.todosTable,
            IndexName: this.todosIndex,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }).promise()

        return result.Items as TodoItem[]
    }

    async createTodo(todoItem: TodoItem): Promise<TodoItem> {
        logger.info(`Creating a new todo item: ${JSON.stringify(todoItem)}`)

        await this.docClient.put({
            TableName: this.todosTable,
            Item: todoItem
        }).promise()

        return todoItem
    }

    async updateTodo(userId: string, todoId: string, todoUpdate: TodoUpdate): Promise<void> {
        logger.info(`Updating todo ${todoId} for user ${userId} with ${JSON.stringify(todoUpdate)}`)

        await this.docClient.update({
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            },
            UpdateExpression: 'set #name = :name, dueDate = :dueDate, done = :done, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#name': 'name'  // 'name' is a reserved word in DynamoDB
            },
            ExpressionAttributeValues: {
                ':name': todoUpdate.name,
                ':dueDate': todoUpdate.dueDate,
                ':done': todoUpdate.done,
                // ':updatedAt': todoUpdate.updatedAt
            }
        }).promise()
    }

    async deleteTodo(userId: string, todoId: string): Promise<void> {
        logger.info(`Deleting todo ${todoId} for user ${userId}`)

        await this.docClient.delete({
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            }
        }).promise()
    }

    async getTodo(userId: string, todoId: string): Promise<TodoItem> {
        logger.info(`Getting todo ${todoId} for user ${userId}`)

        const result = await this.docClient.get({
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            }
        }).promise()

        return result.Item as TodoItem
    }
}