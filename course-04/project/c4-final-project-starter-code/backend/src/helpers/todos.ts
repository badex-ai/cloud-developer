import { TodosAccess } from './todosAcess'
import { AttachmentUtils } from './attachmentUtils';
import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import * as uuid from 'uuid'
import * as createError from 'http-errors'
import { create } from 'domain';
import { createLogger } from '../utils/logger'


// TODO: Implement businessLogic

const attachmentUtils = new AttachmentUtils()
const logger = createLogger('todos')
const todosAccess = new TodosAccess()

const createTodo = async (
    createTodoRequest: CreateTodoRequest,
    userId: string
): Promise<TodoItem> => {
    logger.info(`Creating a todo for user ${userId}`)

    const todoId = uuid.v4()
    const createdAt = new Date().toISOString()
    const attachmentUrl = attachmentUtils.getAttachmentUrl(todoId)

    const newTodo: TodoItem = {
        userId,
        todoId,
        createdAt,
        attachmentUrl,
        done: false,
        ...createTodoRequest
    }

    return await todosAccess.createTodo(newTodo)
}

const getTodosForUser = async (userId: string): Promise<TodoItem[]> => {
    logger.info(`Getting all todos for user ${userId}`)
    const items = await todosAccess.getAllTodos(userId)
    return items
}

const updateTodo = async (
    userId: string,
    todoId: string,
    updateTodoRequest: UpdateTodoRequest
) => {
    logger.info(`Updating todo ${todoId} for user ${userId}`)

    // Check if todo exists
    const todo = await todosAccess.getTodo(userId, todoId)

    if (!todo) {
        throw new createError.NotFound(`Todo with ID ${todoId} not found`)
    }



    await todosAccess.updateTodo(
        userId,
        todoId,
        {
            ...updateTodoRequest

        }
    )
}

const deleteTodo = async (userId: string, todoId: string) => {
    logger.info(`Deleting todo ${todoId} for user ${userId}`)

    // Check if todo exists
    const todo = await todosAccess.getTodo(userId, todoId)

    if (!todo) {
        throw new createError.NotFound(`Todo with ID ${todoId} not found`)
    }

    await todosAccess.deleteTodo(userId, todoId)
}

const createAttachmentPresignedUrl = async (userId: string, todoId: string): Promise<string> => {
    logger.info(`Generating upload URL for todo ${todoId}`)

    // Check if todo exists
    const todo = await todosAccess.getTodo(userId, todoId)

    if (!todo) {
        throw new createError.NotFound(`Todo with ID ${todoId} not found`)
    }

    return attachmentUtils.getUploadUrl(todoId)
}





export { createTodo, updateTodo, deleteTodo, getTodosForUser, createAttachmentPresignedUrl }