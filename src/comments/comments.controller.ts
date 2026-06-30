import {
  Controller,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiParam } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { UpdateCommentDto } from './dto/comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspaceRoleGuard } from '../workspaces/guards/workspace-role.guard';

interface AuthenticatedWorkspaceRequest {
  workspaceRole?: string;
}

@ApiTags('Комментарии к задачам (Comments)')
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @ApiOperation({ summary: 'Изменить текст своего комментария' })
  @ApiParam({ name: 'commentId', description: 'ID комментария' })
  @Patch(':commentId')
  async update(
    @Param('commentId') commentId: string,
    @CurrentUser('id') authorId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.commentsService.update(commentId, authorId, dto);
  }

  @ApiOperation({
    summary: 'Удалить комментарий',
  })
  @ApiParam({ name: 'commentId', description: 'ID комментария' })
  @Delete(':commentId')
  async remove(
    @Param('commentId') commentId: string,
    @CurrentUser('id') userId: string,
    @Req() req: AuthenticatedWorkspaceRequest,
  ) {
    const userRole = req.workspaceRole || 'OBSERVER';
    return this.commentsService.remove(commentId, userId, userRole);
  }
}
