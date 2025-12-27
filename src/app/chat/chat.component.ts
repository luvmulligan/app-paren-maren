import { Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { RealtimeService, ChatMessage } from '../realtime.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatInputModule, MatFormFieldModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef;
  
  messages = signal<ChatMessage[]>([]);
  newMessage = '';
  isMinimized = signal(false);
  private chatSub?: Subscription;
  private shouldScrollToBottom = false;

  constructor(private realtimeService: RealtimeService) {}

  ngOnInit(): void {
    this.chatSub = this.realtimeService.chatMessages().subscribe(messages => {
      this.messages.set(messages);
      this.shouldScrollToBottom = true;
      // Force scroll after a short delay to ensure DOM is rendered
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.chatSub?.unsubscribe();
  }

  sendMessage(): void {
    if (this.newMessage.trim()) {
      console.log('[ChatComponent] Sending message:', this.newMessage.trim());
      this.realtimeService.sendChatMessage(this.newMessage.trim());
      this.newMessage = '';
    }
  }

  toggleMinimize(): void {
    this.isMinimized.update(value => !value);
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        const element = this.messagesContainer.nativeElement;
        element.scrollTop = element.scrollHeight;
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
}
